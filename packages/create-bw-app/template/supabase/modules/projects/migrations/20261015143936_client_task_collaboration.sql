-- Deliberately authored, project-bound client work. Existing tasks stay private.
-- One statement leaves existing permissions intact if any prerequisite/DDL fails.
DO $client_task_migration$
BEGIN
  IF to_regprocedure('public.assert_profile_auth_identity_v1()') IS NULL THEN
    RAISE EXCEPTION 'PROJECTS_MIGRATION_REQUIRED: apply the verified Core identity repair first.' USING ERRCODE='55000';
  END IF;
  PERFORM public.assert_profile_auth_identity_v1();
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.project_tasks'::regclass
    AND conname='project_tasks_milestone_id_fkey' AND cardinality(conkey)=2 AND convalidated) THEN
    RAISE EXCEPTION 'PROJECTS_MIGRATION_REQUIRED: apply the task/milestone project relationship repair first.' USING ERRCODE='55000';
  END IF;
  IF current_user IN ('anon','authenticated','service_role','authenticator') OR NOT pg_catalog.pg_has_role(current_user,
    (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.project_tasks'::regclass),'USAGE') THEN
    RAISE EXCEPTION 'Client task migration requires the trusted application schema owner.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='bw_projects_task_executor') THEN
    CREATE ROLE bw_projects_task_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='bw_projects_task_executor'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Unsafe existing Projects executor role.' USING ERRCODE='55000';
  END IF;
  -- No API role may reach the executor, including indirect and SET-only grants.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles api_role
    WHERE api_role.rolname IN ('anon','authenticated','service_role','authenticator')
      AND pg_catalog.pg_has_role(api_role.oid,'bw_projects_task_executor'::regrole,'MEMBER')) THEN
    RAISE EXCEPTION 'Projects executor must not be granted to API roles.' USING ERRCODE='55000';
  END IF;
  -- PostgreSQL 17 gives CREATEROLE creators ADMIN membership without SET or
  -- INHERIT by default. Only the trusted schema migrator may assume this role
  -- to transfer function ownership; no API/authenticator role receives it.
  EXECUTE format('GRANT bw_projects_task_executor TO %I WITH INHERIT TRUE, SET TRUE',current_user);
  EXECUTE $client_task_ddl$
CREATE SCHEMA IF NOT EXISTS bw_projects_private;
REVOKE ALL ON SCHEMA bw_projects_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public, auth, bw_projects_private TO bw_projects_task_executor;

ALTER TABLE public.project_tasks
  ADD COLUMN task_kind text NOT NULL DEFAULT 'internal',
  ADD COLUMN client_title text,
  ADD COLUMN client_instructions text,
  ADD COLUMN client_organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN client_audience_mode text NOT NULL DEFAULT 'all_eligible',
  ADD COLUMN client_publication text NOT NULL DEFAULT 'draft',
  ADD COLUMN client_workflow text NOT NULL DEFAULT 'open',
  ADD COLUMN client_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN client_generation integer NOT NULL DEFAULT 0,
  ADD COLUMN client_submission_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN client_review_feedback text,
  ADD COLUMN client_reviewed_sequence integer,
  ADD CONSTRAINT project_tasks_kind_check CHECK (task_kind IN ('internal','client')),
  ADD CONSTRAINT project_tasks_client_audience_check CHECK (client_audience_mode IN ('all_eligible','selected')),
  ADD CONSTRAINT project_tasks_client_publication_check CHECK (client_publication IN ('draft','published','withdrawn')),
  ADD CONSTRAINT project_tasks_client_workflow_check CHECK (client_workflow IN ('open','in_progress','submitted','returned','accepted')),
  ADD CONSTRAINT project_tasks_client_revision_check CHECK (client_revision>=0 AND client_generation>=0 AND client_submission_sequence>=0),
  ADD CONSTRAINT project_tasks_client_content_check CHECK (task_kind='internal' OR
    (client_organization_id IS NOT NULL AND length(btrim(client_title)) BETWEEN 1 AND 240 AND length(coalesce(client_instructions,''))<=20000)),
  ADD CONSTRAINT project_tasks_client_identity_key UNIQUE(id,project_id,client_organization_id);
CREATE INDEX idx_project_tasks_client_published ON public.project_tasks(project_id,client_organization_id,id)
  WHERE task_kind='client' AND client_publication='published';

CREATE TABLE bw_projects_private.task_bindings (
  task_id uuid NOT NULL,
  project_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  role_assignment_id uuid NOT NULL REFERENCES public.user_role_assignments(id) ON DELETE CASCADE,
  generation integer NOT NULL,
  is_audience boolean NOT NULL,
  is_responsible boolean NOT NULL DEFAULT false,
  PRIMARY KEY(task_id,profile_id),
  FOREIGN KEY(task_id,project_id,organization_id) REFERENCES public.project_tasks(id,project_id,client_organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX task_bindings_one_responsible ON bw_projects_private.task_bindings(task_id) WHERE is_responsible;
CREATE INDEX task_bindings_profile ON bw_projects_private.task_bindings(profile_id,project_id,organization_id);
CREATE INDEX task_bindings_membership ON bw_projects_private.task_bindings(membership_id);
CREATE INDEX task_bindings_role ON bw_projects_private.task_bindings(role_assignment_id);
CREATE INDEX task_bindings_project_org ON bw_projects_private.task_bindings(project_id,organization_id,profile_id);
CREATE TABLE bw_projects_private.submissions (
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  task_revision integer NOT NULL,
  publication_generation integer NOT NULL,
  response text NOT NULL CHECK(length(btrim(response)) BETWEEN 1 AND 20000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_feedback text,
  PRIMARY KEY(task_id,sequence)
);
CREATE INDEX submissions_actor ON bw_projects_private.submissions(submitted_by_profile_id);
CREATE TABLE bw_projects_private.requests (
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  fingerprint jsonb NOT NULL,
  result_revision integer NOT NULL,
  PRIMARY KEY(actor_profile_id,request_id)
);
CREATE INDEX requests_task ON bw_projects_private.requests(task_id);
CREATE INDEX requests_project ON bw_projects_private.requests(project_id);
ALTER TABLE bw_projects_private.task_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bw_projects_private.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bw_projects_private.requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA bw_projects_private FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA bw_projects_private TO bw_projects_task_executor;
CREATE POLICY executor_bindings ON bw_projects_private.task_bindings TO bw_projects_task_executor USING(true) WITH CHECK(true);
CREATE POLICY executor_submissions ON bw_projects_private.submissions TO bw_projects_task_executor USING(true) WITH CHECK(true);
CREATE POLICY executor_requests ON bw_projects_private.requests TO bw_projects_task_executor USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_tasks TO bw_projects_task_executor;
CREATE POLICY task_executor ON public.project_tasks TO bw_projects_task_executor USING(true) WITH CHECK(true);

CREATE FUNCTION public.can_current_user_create_project_tasks(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles profile JOIN public.user_role_assignments role_assignment ON role_assignment.profile_id=profile.id
    WHERE profile.user_id=auth.uid() AND (role_assignment.role_code='admin' OR
      (role_assignment.role_code='staff' AND EXISTS(SELECT 1 FROM public.project_members member
       WHERE member.project_id=p_project_id AND member.profile_id=profile.id AND member.role IN ('owner','contributor')))))
    AND EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id)
$$;
REVOKE ALL ON FUNCTION public.can_current_user_create_project_tasks(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.can_current_user_create_project_tasks(uuid) TO authenticated,bw_projects_task_executor;
DROP POLICY "Project managers insert project tasks" ON public.project_tasks;
CREATE POLICY "Task-capable staff insert internal tasks" ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK(task_kind='internal' AND public.can_current_user_create_project_tasks(project_id));

-- Project eligibility is evaluated for the task's organization, never via a
-- different organization through which the client can also see this project.
CREATE FUNCTION bw_projects_private.client_eligible(p_project uuid,p_org uuid,p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles profile
 JOIN public.user_role_assignments role_assignment ON role_assignment.profile_id=profile.id AND role_assignment.role_code='client'
 JOIN public.organization_members membership ON membership.profile_id=profile.id AND membership.organization_id=p_org
 JOIN public.project_organizations participant ON participant.project_id=p_project AND participant.organization_id=p_org
 JOIN public.project_client_organizations audience ON audience.project_id=p_project AND audience.organization_id=p_org
 JOIN public.projects project ON project.id=p_project
 WHERE profile.id=p_profile AND profile.user_id IS NOT NULL AND
 (project.client_access_mode='all_org_clients' OR (project.client_access_mode='selected_clients' AND EXISTS(
   SELECT 1 FROM public.project_client_profiles grant_row WHERE grant_row.project_id=p_project AND grant_row.organization_id=p_org AND grant_row.profile_id=p_profile))))
$$;

CREATE FUNCTION bw_projects_private.lock_actor(p_project uuid,p_staff boolean,p_org uuid DEFAULT NULL,p_write boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; actor_role text; member_role text;
BEGIN
 SELECT id INTO actor FROM public.profiles WHERE user_id=auth.uid() FOR SHARE;
 IF actor IS NULL THEN RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 SELECT role_code INTO actor_role FROM public.user_role_assignments WHERE profile_id=actor FOR SHARE;
 IF (p_staff AND actor_role NOT IN ('staff','admin')) OR (NOT p_staff AND actor_role IS DISTINCT FROM 'client') OR actor_role IS NULL THEN
   RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 IF NOT p_staff THEN
   PERFORM id FROM public.organization_members WHERE profile_id=actor AND organization_id=p_org FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 END IF;
 -- Match the established project/member RPC lock order. Direct member changes
 -- conflict with the explicit membership SHARE lock as well.
 PERFORM id FROM public.projects WHERE id=p_project FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 IF p_staff AND actor_role<>'admin' THEN
   SELECT role INTO member_role FROM public.project_members WHERE project_id=p_project AND profile_id=actor FOR SHARE;
   IF member_role IS NULL OR (p_write AND member_role NOT IN ('owner','contributor')) THEN
     RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN actor;
END;
$$;

CREATE FUNCTION bw_projects_private.lock_client(p_project uuid,p_org uuid,p_profile uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM id FROM public.profiles WHERE id=p_profile AND user_id IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client is not currently eligible.' USING ERRCODE='22023'; END IF;
 PERFORM id FROM public.user_role_assignments WHERE profile_id=p_profile AND role_code='client' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client is not currently eligible.' USING ERRCODE='22023'; END IF;
 PERFORM id FROM public.organization_members WHERE profile_id=p_profile AND organization_id=p_org FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client is not currently eligible.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.project_organizations WHERE project_id=p_project AND organization_id=p_org FOR SHARE;
 PERFORM 1 FROM public.project_client_organizations WHERE project_id=p_project AND organization_id=p_org FOR SHARE;
 PERFORM 1 FROM public.project_client_profiles WHERE project_id=p_project AND organization_id=p_org AND profile_id=p_profile FOR SHARE;
 IF NOT bw_projects_private.client_eligible(p_project,p_org,p_profile) THEN
   RAISE EXCEPTION 'Client is not currently eligible.' USING ERRCODE='22023'; END IF;
END;
$$;

CREATE FUNCTION bw_projects_private.task_visible(p_task uuid,p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.project_tasks task WHERE task.id=p_task AND task.task_kind='client' AND task.client_publication='published'
 AND bw_projects_private.client_eligible(task.project_id,task.client_organization_id,p_profile)
 AND (task.milestone_id IS NULL OR EXISTS(SELECT 1 FROM public.project_milestones milestone WHERE milestone.id=task.milestone_id
   AND milestone.project_id=task.project_id AND milestone.visibility='client'))
 AND (task.client_audience_mode='all_eligible' OR EXISTS(SELECT 1 FROM bw_projects_private.task_bindings binding
   WHERE binding.task_id=task.id AND binding.profile_id=p_profile AND binding.is_audience AND binding.generation=task.client_generation)))
$$;

CREATE FUNCTION bw_projects_private.task_json(p_task uuid,p_staff boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE task public.project_tasks%ROWTYPE; value jsonb;
BEGIN
 SELECT * INTO task FROM public.project_tasks WHERE id=p_task AND task_kind='client';
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('id',task.id,'project_id',task.project_id,'client_title',task.client_title,'client_instructions',coalesce(task.client_instructions,''),
 'publication_generation',task.client_generation,'workflow',task.client_workflow,'revision',task.client_revision,'due_date',task.due_date,
 'milestone',(SELECT jsonb_build_object('id',m.id,'title',m.title) FROM public.project_milestones m
   WHERE m.id=task.milestone_id AND m.project_id=task.project_id AND m.visibility='client'),
 'responsible_label',(SELECT coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) FROM bw_projects_private.task_bindings b
   JOIN public.profiles p ON p.id=b.profile_id WHERE b.task_id=task.id AND b.is_responsible
   AND bw_projects_private.client_eligible(task.project_id,task.client_organization_id,b.profile_id)),
 'response',(SELECT s.response FROM bw_projects_private.submissions s WHERE s.task_id=task.id AND s.sequence=task.client_submission_sequence AND s.publication_generation=task.client_generation),
 'review_feedback',task.client_review_feedback,
 'submission_sequence',(SELECT s.sequence FROM bw_projects_private.submissions s WHERE s.task_id=task.id AND s.sequence=task.client_submission_sequence AND s.publication_generation=task.client_generation)) INTO value;
 IF p_staff THEN
   value:=value||jsonb_build_object('publication',task.client_publication,'organization_id',task.client_organization_id,'audience_mode',task.client_audience_mode,
   'selected_profile_ids',coalesce((SELECT jsonb_agg(b.profile_id ORDER BY b.profile_id) FROM bw_projects_private.task_bindings b WHERE b.task_id=task.id AND b.is_audience),'[]'::jsonb),
   'responsible_profile_id',(SELECT b.profile_id FROM bw_projects_private.task_bindings b WHERE b.task_id=task.id AND b.is_responsible),
   'submissions',coalesce((SELECT jsonb_agg(to_jsonb(s)-'task_id' ORDER BY s.sequence DESC) FROM bw_projects_private.submissions s WHERE s.task_id=task.id),'[]'::jsonb));
 END IF;
 RETURN value;
END;
$$;

CREATE FUNCTION public.list_current_client_project_tasks(p_project_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(bw_projects_private.task_json(task.id,false) ORDER BY task.created_at,task.id),'[]'::jsonb)
 FROM public.project_tasks task WHERE task.project_id=p_project_id AND bw_projects_private.task_visible(task.id,public.current_profile_id())
$$;
REVOKE ALL ON FUNCTION public.list_current_client_project_tasks(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.list_current_client_project_tasks(uuid) TO authenticated;

CREATE FUNCTION public.get_project_client_task_workbench(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public.current_profile_id(); actor_role text;
BEGIN
 SELECT role_code INTO actor_role FROM public.user_role_assignments WHERE profile_id=actor;
 IF actor_role IS NULL OR actor_role NOT IN ('staff','admin') OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id) OR
 (actor_role<>'admin' AND NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=p_project_id AND profile_id=actor)) THEN
   RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('tasks',coalesce((SELECT jsonb_agg(bw_projects_private.task_json(task.id,true) ORDER BY task.created_at,task.id)
   FROM public.project_tasks task WHERE task.project_id=p_project_id AND task.task_kind='client'),'[]'::jsonb),
 'organizations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',org.id,'name',org.name,'eligible_clients',coalesce((
   SELECT jsonb_agg(jsonb_build_object('profile_id',profile.id,'label',coalesce(nullif(btrim(concat_ws(' ',profile.first_name,profile.last_name)),''),profile.email)) ORDER BY profile.id)
   FROM public.organization_members member JOIN public.profiles profile ON profile.id=member.profile_id
   WHERE member.organization_id=org.id AND bw_projects_private.client_eligible(p_project_id,org.id,profile.id)),'[]'::jsonb)) ORDER BY org.name,org.id)
   FROM public.project_organizations participant JOIN public.organizations org ON org.id=participant.organization_id WHERE participant.project_id=p_project_id),'[]'::jsonb),
 'capabilities',jsonb_build_object('can_create_tasks',public.can_current_user_create_project_tasks(p_project_id),
   'can_share_client_tasks',public.can_current_user_create_project_tasks(p_project_id),'can_review_client_tasks',public.can_current_user_create_project_tasks(p_project_id)));
END;
$$;
REVOKE ALL ON FUNCTION public.get_project_client_task_workbench(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_project_client_task_workbench(uuid) TO authenticated;

CREATE FUNCTION bw_projects_private.lock_task_milestone(p_project uuid,p_task uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM milestone.id FROM public.project_milestones milestone JOIN public.project_tasks task ON task.milestone_id=milestone.id
 WHERE task.id=p_task AND task.project_id=p_project FOR SHARE OF milestone;
END;
$$;

CREATE FUNCTION bw_projects_private.validate_configuration(p_project uuid,p_input jsonb,p_publish boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; milestone uuid; responsible uuid; selected uuid[]; person uuid;
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR NOT p_input ?& ARRAY['clientTitle','clientInstructions','organizationId','audienceMode','selectedProfileIds','responsibleProfileId','milestoneId','dueDate']
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('clientTitle','clientInstructions','organizationId','audienceMode','selectedProfileIds','responsibleProfileId','milestoneId','dueDate'))
 OR jsonb_typeof(p_input->'clientTitle') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'clientTitle')) NOT BETWEEN 1 AND 240
 OR jsonb_typeof(p_input->'clientInstructions') IS DISTINCT FROM 'string' OR length(p_input->>'clientInstructions')>20000
 OR jsonb_typeof(p_input->'organizationId') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_input->'audienceMode') IS DISTINCT FROM 'string' OR p_input->>'audienceMode' NOT IN ('all_eligible','selected')
 OR jsonb_typeof(p_input->'selectedProfileIds') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid client task configuration.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_input->'selectedProfileIds')>500 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'selectedProfileIds') e WHERE jsonb_typeof(e)<>'string') THEN
   RAISE EXCEPTION 'Invalid selected client audience.' USING ERRCODE='22023'; END IF;
 org:=(p_input->>'organizationId')::uuid;
 milestone:=(p_input->>'milestoneId')::uuid;
 responsible:=(p_input->>'responsibleProfileId')::uuid;
 selected:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_input->'selectedProfileIds'));
 IF cardinality(selected)<>(SELECT count(DISTINCT x) FROM unnest(selected) x) OR
 (p_input->>'audienceMode'='all_eligible' AND cardinality(selected)>0) OR
 (p_input->>'audienceMode'='selected' AND responsible IS NOT NULL AND NOT responsible=ANY(selected)) THEN
   RAISE EXCEPTION 'Responsibility must remain within the selected audience.' USING ERRCODE='22023'; END IF;
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM public.project_organizations WHERE project_id=p_project AND organization_id=org) THEN
   RAISE EXCEPTION 'Task organization must participate in the project.' USING ERRCODE='22023'; END IF;
 IF (p_input->>'dueDate') IS NOT NULL THEN
   IF (p_input->>'dueDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (p_input->>'dueDate')::date::text<>p_input->>'dueDate' THEN
     RAISE EXCEPTION 'Invalid task due date.' USING ERRCODE='22023'; END IF;
 END IF;
 IF milestone IS NOT NULL THEN
   PERFORM id FROM public.project_milestones WHERE id=milestone AND project_id=p_project AND (NOT p_publish OR visibility='client') FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Publishing requires a client-visible milestone in this project.' USING ERRCODE='22023'; END IF;
 END IF;
 FOR person IN SELECT DISTINCT x FROM unnest(selected||CASE WHEN responsible IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[responsible] END) x ORDER BY x LOOP
   PERFORM bw_projects_private.lock_client(p_project,org,person);
 END LOOP;
 IF p_publish THEN
   IF length(btrim(p_input->>'clientInstructions'))=0 OR (p_input->>'audienceMode'='selected' AND cardinality(selected)=0)
     OR NOT EXISTS(SELECT 1 FROM public.projects project JOIN public.project_client_organizations audience ON audience.project_id=project.id
       WHERE project.id=p_project AND project.client_access_mode<>'hidden' AND audience.organization_id=org) THEN
     RAISE EXCEPTION 'Publishing requires authored instructions and a currently eligible project audience.' USING ERRCODE='22023'; END IF;
 END IF;
END;
$$;

CREATE FUNCTION bw_projects_private.write_bindings(p_task uuid,p_project uuid,p_org uuid,p_generation integer,p_selected uuid[],p_responsible uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM bw_projects_private.task_bindings WHERE task_id=p_task;
 INSERT INTO bw_projects_private.task_bindings(task_id,project_id,organization_id,profile_id,membership_id,role_assignment_id,generation,is_audience,is_responsible)
 SELECT p_task,p_project,p_org,person.profile_id,membership.id,role_assignment.id,p_generation,person.profile_id=ANY(p_selected),coalesce(person.profile_id=p_responsible,false)
 FROM (SELECT DISTINCT x AS profile_id FROM unnest(p_selected||CASE WHEN p_responsible IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[p_responsible] END) x) person
 JOIN public.organization_members membership ON membership.organization_id=p_org AND membership.profile_id=person.profile_id
 JOIN public.user_role_assignments role_assignment ON role_assignment.profile_id=person.profile_id AND role_assignment.role_code='client';
END;
$$;

-- This invoker guard observes the effective caller. A SECURITY DEFINER guard
-- would see its own owner and let ordinary internal APIs bypass the workflow.
CREATE FUNCTION bw_projects_private.guard_task_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user='bw_projects_task_executor' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='DELETE' THEN
   IF OLD.task_kind='client' THEN RAISE EXCEPTION 'Client tasks require their dedicated workflow.' USING ERRCODE='42501'; END IF;
   RETURN OLD;
 END IF;
 IF NEW.task_kind='client' OR (TG_OP='UPDATE' AND OLD.task_kind='client') OR NEW.client_title IS NOT NULL OR NEW.client_instructions IS NOT NULL
 OR NEW.client_organization_id IS NOT NULL OR NEW.client_audience_mode<>'all_eligible' OR NEW.client_publication<>'draft'
 OR NEW.client_workflow<>'open' OR NEW.client_revision<>0 OR NEW.client_generation<>0 OR NEW.client_submission_sequence<>0
 OR NEW.client_review_feedback IS NOT NULL OR NEW.client_reviewed_sequence IS NOT NULL THEN
   RAISE EXCEPTION 'Client tasks require their dedicated workflow.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER aa_project_client_task_write BEFORE INSERT OR UPDATE OR DELETE ON public.project_tasks
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.guard_task_write();

CREATE FUNCTION bw_projects_private.valid_task_assignee(p_project uuid,p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_profile IS NULL OR EXISTS(SELECT 1 FROM public.project_members member JOIN public.user_role_assignments role_assignment
 ON role_assignment.profile_id=member.profile_id AND role_assignment.role_code IN ('staff','admin')
 WHERE member.project_id=p_project AND member.profile_id=p_profile AND member.role IN ('owner','contributor'))
$$;
CREATE OR REPLACE FUNCTION public.enforce_project_task_assignee_and_contributor_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_actor_profile_id uuid:=public.current_profile_id();
BEGIN
 IF NEW.task_kind='client' AND current_user='bw_projects_task_executor' THEN
   IF NOT bw_projects_private.valid_task_assignee(NEW.project_id,NEW.assignee_profile_id) THEN
     RAISE EXCEPTION 'Tasks can only be assigned to current project managers or collaborators.' USING ERRCODE='23514'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.assignee_profile_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_members member WHERE member.project_id=NEW.project_id
   AND member.profile_id=NEW.assignee_profile_id AND member.role IN ('owner','contributor')) THEN
   RAISE EXCEPTION 'Tasks can only be assigned to project managers or collaborators.' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND public.is_staff() AND NOT public.is_admin() AND NOT public.is_project_owner_member(OLD.project_id) THEN
   IF OLD.assignee_profile_id IS DISTINCT FROM v_actor_profile_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
   OR NEW.milestone_id IS DISTINCT FROM OLD.milestone_id OR NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
   OR NEW.priority IS DISTINCT FROM OLD.priority OR NEW.assignee_profile_id IS DISTINCT FROM OLD.assignee_profile_id
   OR NEW.reporter_profile_id IS DISTINCT FROM OLD.reporter_profile_id OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.due_date IS DISTINCT FROM OLD.due_date THEN
     RAISE EXCEPTION 'Collaborators can only update the state of their assigned tasks.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION public.manage_project_client_task(p_project_id uuid,p_task_id uuid,p_request_id uuid,p_expected_revision integer,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE actor uuid; task public.project_tasks%ROWTYPE; fingerprint jsonb; prior bw_projects_private.requests%ROWTYPE;
 config jsonb; task_id uuid:=p_task_id; generation integer; selected uuid[]; responsible uuid; review_sequence integer;
BEGIN
 actor:=bw_projects_private.lock_actor(p_project_id,true);
 IF p_request_id IS NULL OR p_action IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid task action.' USING ERRCODE='22023'; END IF;
 fingerprint:=jsonb_build_object('projectId',p_project_id,'taskId',p_task_id,'expectedRevision',p_expected_revision,'action',p_action,'input',p_input);
 SELECT * INTO prior FROM bw_projects_private.requests WHERE actor_profile_id=actor AND request_id=p_request_id;
 IF FOUND THEN
   IF prior.fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Task request key already used.' USING ERRCODE='BW409'; END IF;
   RETURN bw_projects_private.task_json(prior.task_id,true);
 END IF;
 IF p_action='create' THEN
   IF p_task_id IS NOT NULL OR p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid create action.' USING ERRCODE='22023'; END IF;
   PERFORM bw_projects_private.validate_configuration(p_project_id,p_input,false);
   task_id:=gen_random_uuid();
   INSERT INTO public.project_tasks(id,project_id,milestone_id,title,task_kind,reporter_profile_id,client_title,client_instructions,client_organization_id,client_audience_mode,due_date,client_revision)
   VALUES(task_id,p_project_id,(p_input->>'milestoneId')::uuid,p_input->>'clientTitle','client',actor,p_input->>'clientTitle',p_input->>'clientInstructions',
     (p_input->>'organizationId')::uuid,p_input->>'audienceMode',(p_input->>'dueDate')::date,1);
   selected:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_input->'selectedProfileIds'));
   PERFORM bw_projects_private.write_bindings(task_id,p_project_id,(p_input->>'organizationId')::uuid,0,selected,(p_input->>'responsibleProfileId')::uuid);
 ELSE
   IF p_task_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Expected task revision required.' USING ERRCODE='22023'; END IF;
   IF p_action='configure' THEN PERFORM bw_projects_private.validate_configuration(p_project_id,p_input,false); END IF;
   IF p_action='publish' THEN
     SELECT * INTO task FROM public.project_tasks WHERE id=task_id AND project_id=p_project_id AND task_kind='client';
     IF NOT FOUND THEN RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
     SELECT coalesce(array_agg(profile_id ORDER BY profile_id) FILTER(WHERE is_audience),ARRAY[]::uuid[]),
       (array_agg(profile_id) FILTER(WHERE is_responsible))[1] INTO selected,responsible FROM bw_projects_private.task_bindings WHERE task_id=task.id;
     config:=jsonb_build_object('clientTitle',task.client_title,'clientInstructions',coalesce(task.client_instructions,''),'organizationId',task.client_organization_id,
       'audienceMode',task.client_audience_mode,'selectedProfileIds',to_jsonb(selected),'responsibleProfileId',responsible,'milestoneId',task.milestone_id,'dueDate',task.due_date);
     PERFORM bw_projects_private.validate_configuration(p_project_id,config,true);
   END IF;
   -- Milestone locks precede task locks, matching hide/delete cleanup.
   PERFORM bw_projects_private.lock_task_milestone(p_project_id,task_id);
   SELECT * INTO task FROM public.project_tasks WHERE id=task_id AND project_id=p_project_id AND task_kind='client' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
   IF task.client_revision<>p_expected_revision THEN RAISE EXCEPTION 'Task changed. Refresh before acting.' USING ERRCODE='40001'; END IF;
   IF p_action='configure' THEN
     generation:=task.client_generation+CASE WHEN task.client_publication='published' THEN 1 ELSE 0 END;
     DELETE FROM bw_projects_private.task_bindings WHERE task_id=task.id;
     UPDATE public.project_tasks SET client_title=p_input->>'clientTitle',client_instructions=p_input->>'clientInstructions',
       client_organization_id=(p_input->>'organizationId')::uuid,client_audience_mode=p_input->>'audienceMode',milestone_id=(p_input->>'milestoneId')::uuid,
       due_date=(p_input->>'dueDate')::date,client_publication=CASE WHEN task.client_publication='draft' THEN 'draft' ELSE 'withdrawn' END,
       client_generation=generation,client_workflow='open',status='todo',client_review_feedback=NULL,client_reviewed_sequence=NULL,client_revision=client_revision+1
       WHERE id=task.id;
     selected:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_input->'selectedProfileIds'));
     PERFORM bw_projects_private.write_bindings(task.id,p_project_id,(p_input->>'organizationId')::uuid,generation,selected,(p_input->>'responsibleProfileId')::uuid);
   ELSIF p_action='publish' THEN
     IF p_input<>'{}'::jsonb OR task.client_publication='published' THEN RAISE EXCEPTION 'Invalid publication action.' USING ERRCODE='40001'; END IF;
     generation:=task.client_generation+1;
     UPDATE public.project_tasks SET client_publication='published',client_generation=generation,client_workflow='open',status='todo',
       client_revision=client_revision+1,client_review_feedback=NULL,client_reviewed_sequence=NULL WHERE id=task.id;
     PERFORM bw_projects_private.write_bindings(task.id,p_project_id,task.client_organization_id,generation,selected,responsible);
   ELSIF p_action='withdraw' THEN
     IF p_input<>'{}'::jsonb OR task.client_publication<>'published' THEN RAISE EXCEPTION 'Invalid withdrawal action.' USING ERRCODE='40001'; END IF;
     UPDATE public.project_tasks SET client_publication='withdrawn',client_generation=client_generation+1,client_workflow='open',status='todo',
       client_revision=client_revision+1,client_review_feedback=NULL,client_reviewed_sequence=NULL WHERE id=task.id;
   ELSIF p_action IN ('return','accept') THEN
     IF NOT p_input ?& ARRAY['submissionSequence','feedback'] OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('submissionSequence','feedback'))
       OR jsonb_typeof(p_input->'submissionSequence') IS DISTINCT FROM 'number' OR jsonb_typeof(p_input->'feedback') IS DISTINCT FROM 'string'
       OR length(p_input->>'feedback')>20000 OR (p_action='return' AND length(btrim(p_input->>'feedback'))=0) THEN
       RAISE EXCEPTION 'Invalid submission review.' USING ERRCODE='22023'; END IF;
     review_sequence:=(p_input->>'submissionSequence')::integer;
     IF task.client_publication<>'published' OR task.client_workflow<>'submitted' OR task.client_submission_sequence<>review_sequence
       OR NOT EXISTS(SELECT 1 FROM bw_projects_private.submissions s WHERE s.task_id=task.id AND s.sequence=review_sequence AND s.publication_generation=task.client_generation) THEN
       RAISE EXCEPTION 'Submitted version changed. Refresh before reviewing.' USING ERRCODE='40001'; END IF;
     UPDATE public.project_tasks SET client_workflow=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'returned' END,
       status=CASE WHEN p_action='accept' THEN 'done' ELSE 'todo' END,client_revision=client_revision+1,
       client_review_feedback=nullif(btrim(p_input->>'feedback'),''),client_reviewed_sequence=review_sequence WHERE id=task.id;
     UPDATE bw_projects_private.submissions SET review_feedback=nullif(btrim(p_input->>'feedback'),'') WHERE task_id=task.id AND sequence=review_sequence;
   ELSE RAISE EXCEPTION 'Invalid staff task action.' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO bw_projects_private.requests(actor_profile_id,request_id,project_id,task_id,fingerprint,result_revision)
 SELECT actor,p_request_id,p_project_id,task_id,fingerprint,client_revision FROM public.project_tasks WHERE id=task_id;
 RETURN bw_projects_private.task_json(task_id,true);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Task request key already used.' USING ERRCODE='BW409';
END;
$$;

CREATE FUNCTION public.act_on_current_client_project_task(p_project_id uuid,p_task_id uuid,p_request_id uuid,p_expected_revision integer,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; task public.project_tasks%ROWTYPE; org uuid; fingerprint jsonb; prior bw_projects_private.requests%ROWTYPE;
BEGIN
 SELECT client_organization_id INTO org FROM public.project_tasks WHERE id=p_task_id AND project_id=p_project_id AND task_kind='client';
 actor:=bw_projects_private.lock_actor(p_project_id,false,org);
 IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid client action.' USING ERRCODE='22023'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('start','submit') OR (p_action='start' AND p_input<>'{}'::jsonb)
 OR (p_action='submit' AND (NOT p_input ? 'response' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k<>'response')
   OR jsonb_typeof(p_input->'response') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'response')) NOT BETWEEN 1 AND 20000)) THEN
   RAISE EXCEPTION 'Invalid client action.' USING ERRCODE='22023'; END IF;
 BEGIN
   PERFORM bw_projects_private.lock_client(p_project_id,org,actor);
 EXCEPTION WHEN invalid_parameter_value THEN
   RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501';
 END;
 PERFORM bw_projects_private.lock_task_milestone(p_project_id,p_task_id);
 SELECT * INTO task FROM public.project_tasks WHERE id=p_task_id AND project_id=p_project_id AND task_kind='client' FOR UPDATE;
 IF NOT FOUND OR task.client_organization_id IS DISTINCT FROM org OR NOT bw_projects_private.task_visible(p_task_id,actor) THEN
   RAISE EXCEPTION 'Task access denied.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM bw_projects_private.task_bindings WHERE task_id=task.id AND profile_id=actor FOR SHARE;
 fingerprint:=jsonb_build_object('projectId',p_project_id,'taskId',p_task_id,'expectedRevision',p_expected_revision,'action',p_action,'input',p_input);
 SELECT * INTO prior FROM bw_projects_private.requests WHERE actor_profile_id=actor AND request_id=p_request_id;
 IF FOUND THEN
   IF prior.fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Task request key already used.' USING ERRCODE='BW409'; END IF;
   RETURN bw_projects_private.task_json(task.id,false);
 END IF;
 IF task.client_revision<>p_expected_revision OR task.client_workflow NOT IN ('open','in_progress','returned') OR (p_action='start' AND task.client_workflow='in_progress') THEN
   RAISE EXCEPTION 'Task changed. Refresh before acting.' USING ERRCODE='40001'; END IF;
 IF p_action='submit' THEN
   INSERT INTO bw_projects_private.submissions(task_id,sequence,task_revision,publication_generation,response,submitted_by_profile_id)
   VALUES(task.id,task.client_submission_sequence+1,task.client_revision+1,task.client_generation,p_input->>'response',actor);
 END IF;
 UPDATE public.project_tasks SET client_workflow=CASE WHEN p_action='submit' THEN 'submitted' ELSE 'in_progress' END,status='in_progress',
   client_revision=client_revision+1,client_submission_sequence=client_submission_sequence+CASE WHEN p_action='submit' THEN 1 ELSE 0 END,
   client_review_feedback=CASE WHEN p_action='submit' THEN NULL ELSE client_review_feedback END,
   client_reviewed_sequence=CASE WHEN p_action='submit' THEN NULL ELSE client_reviewed_sequence END WHERE id=task.id;
 INSERT INTO bw_projects_private.requests(actor_profile_id,request_id,project_id,task_id,fingerprint,result_revision)
 SELECT actor,p_request_id,p_project_id,task.id,fingerprint,client_revision FROM public.project_tasks WHERE id=task.id;
 RETURN bw_projects_private.task_json(task.id,false);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Task request key already used.' USING ERRCODE='BW409';
END;
$$;

-- Eligibility removal affects only private bindings, avoiding task/source lock
-- inversion. Responsibility is a flag on the binding, never a task column.
CREATE FUNCTION bw_projects_private.revoke_bindings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='user_role_assignments' THEN
   IF TG_OP='DELETE' OR NEW.role_code IS DISTINCT FROM OLD.role_code OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
     DELETE FROM bw_projects_private.task_bindings WHERE role_assignment_id=OLD.id;
   END IF;
 ELSIF TG_TABLE_NAME='organization_members' THEN
   IF TG_OP='DELETE' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
     DELETE FROM bw_projects_private.task_bindings WHERE membership_id=OLD.id;
   END IF;
 ELSIF TG_TABLE_NAME='profiles' THEN
   IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN DELETE FROM bw_projects_private.task_bindings WHERE profile_id=OLD.id; END IF;
 ELSIF TG_TABLE_NAME='projects' THEN
   DELETE FROM bw_projects_private.task_bindings b WHERE b.project_id=NEW.id
     AND NOT bw_projects_private.client_eligible(b.project_id,b.organization_id,b.profile_id);
 ELSE
   DELETE FROM bw_projects_private.task_bindings b WHERE b.project_id=OLD.project_id AND b.organization_id=OLD.organization_id
     AND NOT bw_projects_private.client_eligible(b.project_id,b.organization_id,b.profile_id);
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER trg_client_task_role_revocation AFTER UPDATE OF role_code,profile_id OR DELETE ON public.user_role_assignments
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_membership_revocation AFTER UPDATE OF organization_id,profile_id OR DELETE ON public.organization_members
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_profile_revocation AFTER UPDATE OF user_id ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_project_mode_revocation AFTER UPDATE OF client_access_mode ON public.projects
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_project_profile_revocation AFTER UPDATE OR DELETE ON public.project_client_profiles
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_project_audience_revocation AFTER UPDATE OR DELETE ON public.project_client_organizations
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();
CREATE TRIGGER trg_client_task_participation_revocation AFTER UPDATE OR DELETE ON public.project_organizations
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.revoke_bindings();

CREATE FUNCTION bw_projects_private.withdraw_milestone_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   UPDATE public.project_tasks SET milestone_id=NULL,client_publication='withdrawn',client_generation=client_generation+1,
     client_revision=client_revision+1,client_workflow='open',status='todo',client_review_feedback=NULL,client_reviewed_sequence=NULL
     WHERE milestone_id=OLD.id AND task_kind='client';
 ELSIF OLD.visibility='client' AND NEW.visibility<>'client' THEN
   UPDATE public.project_tasks SET client_publication='withdrawn',client_generation=client_generation+1,
     client_revision=client_revision+1,client_workflow='open',status='todo',client_review_feedback=NULL,client_reviewed_sequence=NULL
     WHERE milestone_id=OLD.id AND task_kind='client';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER ab_withdraw_milestone_client_tasks BEFORE UPDATE OF visibility OR DELETE ON public.project_milestones
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.withdraw_milestone_tasks();

CREATE FUNCTION bw_projects_private.delete_project_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.project_tasks WHERE project_id=OLD.id AND task_kind='client';
 RETURN OLD;
END;
$$;
CREATE TRIGGER ab_delete_project_client_tasks BEFORE DELETE ON public.projects
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.delete_project_tasks();
CREATE FUNCTION bw_projects_private.unlink_profile_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.project_tasks SET assignee_profile_id=CASE WHEN assignee_profile_id=OLD.id THEN NULL ELSE assignee_profile_id END,
   reporter_profile_id=CASE WHEN reporter_profile_id=OLD.id THEN NULL ELSE reporter_profile_id END
   WHERE task_kind='client' AND (assignee_profile_id=OLD.id OR reporter_profile_id=OLD.id);
 RETURN OLD;
END;
$$;
CREATE TRIGGER ab_unlink_profile_client_tasks BEFORE DELETE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION bw_projects_private.unlink_profile_tasks();

-- Only these tightly scoped mutation entry points/trigger handlers receive the
-- executor identity. API roles cannot SET ROLE to it or write private records.
GRANT CREATE ON SCHEMA public,bw_projects_private TO bw_projects_task_executor;
ALTER FUNCTION public.manage_project_client_task(uuid,uuid,uuid,integer,text,jsonb) OWNER TO bw_projects_task_executor;
ALTER FUNCTION public.act_on_current_client_project_task(uuid,uuid,uuid,integer,text,jsonb) OWNER TO bw_projects_task_executor;
ALTER FUNCTION bw_projects_private.withdraw_milestone_tasks() OWNER TO bw_projects_task_executor;
ALTER FUNCTION bw_projects_private.delete_project_tasks() OWNER TO bw_projects_task_executor;
ALTER FUNCTION bw_projects_private.unlink_profile_tasks() OWNER TO bw_projects_task_executor;
REVOKE CREATE ON SCHEMA public,bw_projects_private FROM bw_projects_task_executor;
REVOKE ALL ON FUNCTION public.manage_project_client_task(uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.act_on_current_client_project_task(uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.manage_project_client_task(uuid,uuid,uuid,integer,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_current_client_project_task(uuid,uuid,uuid,integer,text,jsonb) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bw_projects_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bw_projects_private TO bw_projects_task_executor;

CREATE OR REPLACE FUNCTION public.set_project_client_access(
  target_project_id uuid,
  target_mode text,
  target_organization_ids uuid[],
  target_profile_grants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
  v_organization_ids uuid[] := COALESCE(target_organization_ids, ARRAY[]::uuid[]);
  v_profile_grants jsonb := COALESCE(target_profile_grants, '[]'::jsonb);
  v_previous_mode text;
  v_previous_organization_ids uuid[];
  v_previous_profile_grants jsonb;
BEGIN
  IF target_mode IS NULL
    OR target_mode NOT IN ('hidden', 'all_org_clients', 'selected_clients') THEN
    RAISE EXCEPTION 'Invalid project client access mode.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_profile_grants) <> 'array' THEN
    RAISE EXCEPTION 'Profile grants must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  SELECT project.client_access_mode
  INTO v_previous_mode
  FROM public.projects project
  WHERE project.id = target_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(target_project_id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage client project access.'
      USING ERRCODE = '42501';
  END IF;

  IF target_mode <> 'hidden' AND cardinality(v_organization_ids) = 0 THEN
    RAISE EXCEPTION 'Visible client access requires at least one organization.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    LEFT JOIN public.project_organizations participant
      ON participant.project_id = target_project_id
     AND participant.organization_id = selected.organization_id
    WHERE selected.organization_id IS NULL OR participant.project_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every client organization must participate in the project.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND jsonb_array_length(v_profile_grants) = 0 THEN
    RAISE EXCEPTION 'Selected-clients mode requires at least one profile grant.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_profile_grants)
        AS access_grant(organization_id uuid, profile_id uuid)
      WHERE access_grant.organization_id = selected.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'Every selected organization requires at least one selected client.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_profile_grants)
      AS access_grant(organization_id uuid, profile_id uuid)
    LEFT JOIN public.organization_members org_member
      ON org_member.organization_id = access_grant.organization_id
     AND org_member.profile_id = access_grant.profile_id
    LEFT JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = access_grant.profile_id
     AND role_assignment.role_code = 'client'
    LEFT JOIN public.profiles profile
      ON profile.id = access_grant.profile_id
     AND profile.user_id IS NOT NULL
    WHERE access_grant.organization_id IS NULL
      OR access_grant.profile_id IS NULL
      OR NOT (access_grant.organization_id = ANY(v_organization_ids))
      OR org_member.id IS NULL
      OR role_assignment.id IS NULL
      OR profile.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every selected profile must be an active client member with a login.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(audience.organization_id ORDER BY audience.organization_id), ARRAY[]::uuid[])
  INTO v_previous_organization_ids
  FROM public.project_client_organizations audience
  WHERE audience.project_id = target_project_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'organization_id', client_profile.organization_id,
        'profile_id', client_profile.profile_id
      ) ORDER BY client_profile.organization_id, client_profile.profile_id
    ),
    '[]'::jsonb
  )
  INTO v_previous_profile_grants
  FROM public.project_client_profiles client_profile
  WHERE client_profile.project_id = target_project_id;

  -- Retain unchanged audience keys. Losing actual eligibility still removes
  -- task bindings; a no-op save or selected-to-all transition must not do so.
  INSERT INTO public.project_client_organizations(project_id,organization_id,added_by_profile_id)
  SELECT target_project_id,selected.organization_id,v_actor_profile_id
  FROM (SELECT DISTINCT organization_id FROM unnest(v_organization_ids) AS requested(organization_id)) selected
  ON CONFLICT(project_id,organization_id) DO NOTHING;

  IF target_mode='selected_clients' THEN
    INSERT INTO public.project_client_profiles(project_id,organization_id,profile_id,granted_by_profile_id)
    SELECT DISTINCT target_project_id,access_grant.organization_id,access_grant.profile_id,v_actor_profile_id
    FROM jsonb_to_recordset(v_profile_grants) AS access_grant(organization_id uuid,profile_id uuid)
    ON CONFLICT(project_id,organization_id,profile_id) DO NOTHING;
  END IF;
  UPDATE public.projects SET client_access_mode=target_mode WHERE id=target_project_id;
  DELETE FROM public.project_client_profiles existing
  WHERE existing.project_id=target_project_id AND (target_mode<>'selected_clients' OR NOT EXISTS(
    SELECT 1 FROM jsonb_to_recordset(v_profile_grants) AS requested(organization_id uuid,profile_id uuid)
    WHERE requested.organization_id=existing.organization_id AND requested.profile_id=existing.profile_id));
  DELETE FROM public.project_client_organizations
  WHERE project_id=target_project_id AND NOT organization_id=ANY(v_organization_ids);

  INSERT INTO public.app_activity_events (
    domain, event_type, entity_table, entity_id, actor_profile_id, summary, payload
  )
  VALUES (
    'projects',
    'project_client_access_changed',
    'projects',
    target_project_id,
    v_actor_profile_id,
    'Acesso de clientes atualizado.',
    jsonb_build_object(
      'project_id', target_project_id,
      'previous_mode', v_previous_mode,
      'mode', target_mode,
      'previous_organization_ids', to_jsonb(v_previous_organization_ids),
      'organization_ids', to_jsonb(v_organization_ids),
      'previous_profile_grants', v_previous_profile_grants,
      'profile_grants', CASE WHEN target_mode = 'selected_clients' THEN v_profile_grants ELSE '[]'::jsonb END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  TO authenticated;

  $client_task_ddl$;
  PERFORM pg_catalog.pg_notify('pgrst','reload schema');
END;
$client_task_migration$;
