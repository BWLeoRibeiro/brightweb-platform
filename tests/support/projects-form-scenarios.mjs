import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { ProjectsUiProvider } from '../../packages/module-projects/src/ui/context.tsx';
import { CreateProjectTaskSheet } from '../../packages/module-projects/src/ui/create-project-task-sheet.tsx';
import { ProjectTaskCreateSheet } from '../../packages/module-projects/src/ui/project-detail-create-sheets/project-task-create-sheet.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent(){}};
for(const detail of [false,true]){
  const requests=[];let fail=true,tree;
  const client={createTask:async(id,input)=>{requests.push({id,input});if(fail)throw new Error('retry');return {};}};
  const component=detail?React.createElement(ProjectTaskCreateSheet,{projectId:'project',members:[],milestones:[],initialOpen:true}):React.createElement(CreateProjectTaskSheet,{projects:[{id:'project',name:'Project'}],initialOpen:true});
  await act(async()=>{tree=create(React.createElement(ProjectsUiProvider,{client},component));});
  const field=id=>tree.root.findByProps({id});
  const title=detail?'task-create-title':'task-title',status=detail?'task-create-status':'task-status',reason=detail?'task-create-blocked':'task-blocked-reason';
  const change=async(id,value)=>act(async()=>field(id).props.onChange({target:{value}}));
  const submit=async()=>act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  const disabled=()=>tree.root.findAll(n=>n.type==='Button'&&n.props.type==='submit')[0].props.disabled;
  await change(title,'  Task  ');await change(status,'blocked');await change(reason,'   ');
  assert.equal(disabled(),true);await submit();assert.equal(requests.length,0);
  await change(reason,'waiting');assert.equal(disabled(),false);
  await change(status,'todo');await change(status,'blocked');assert.equal(field(reason).props.value,'');assert.equal(disabled(),true);
  await change(status,'todo');
  await act(async()=>tree.root.findAllByType('Calendar')[0].props.onSelect(new Date(2026,8,10)));
  await act(async()=>tree.root.findAllByType('Calendar')[1].props.onSelect(new Date(2026,8,9)));
  assert.equal(disabled(),true);await submit();assert.equal(requests.length,0);
  await act(async()=>tree.root.findAllByType('Calendar')[1].props.onSelect(new Date(2026,8,10)));
  await submit();assert.equal(requests.length,1);assert.equal(field(title).props.value,'  Task  ');assert.equal(tree.root.findByType('Sheet').props.open,true);
  fail=false;await submit();assert.equal(requests.length,2);assert.equal(requests[1].input.title,'Task');assert.equal(requests[1].input.blockedReason,undefined);assert.equal(requests[1].input.startDate,'2026-09-10');assert.equal(tree.root.findByType('Sheet').props.open,false);assert.equal(field(title).props.value,'');
  await act(async()=>tree.unmount());
}


function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const detail of [false, true]) {
  for (const transition of ['reopen', 'client', 'project']) {
    for (const fails of [false, true]) {
      const requests = [];
      globalThis.projectsFormRefreshes = 0;
      globalThis.projectsFormMessages = [];
      globalThis.window.dispatchEvent = () => { globalThis.projectsFormRefreshes++; };
      const makeClient = () => ({ createTask(projectId, input) {
        const request = { ...deferred(), projectId, input };
        requests.push(request);
        return request.promise;
      } });
      const firstClient = makeClient(), secondClient = makeClient();
      let client = firstClient, projectId = 'a', tree;
      const render = () => React.createElement(ProjectsUiProvider, { client }, detail
        ? React.createElement(ProjectTaskCreateSheet, { projectId, members: [], milestones: [], initialOpen: true })
        : React.createElement(CreateProjectTaskSheet, { projects: [{ id: projectId, name: projectId }], initialOpen: true }));
      await act(async () => { tree = create(render()); });
      const titleId = detail ? 'task-create-title' : 'task-title';
      const title = () => tree.root.findByProps({ id: titleId });
      const change = async value => act(async () => title().props.onChange({ target: { value } }));
      const submit = () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
      const disabled = () => tree.root.findAll(n => n.type === 'Button' && n.props.type === 'submit')[0].props.disabled;
      await change('Task A');
      await act(async () => { void submit(); void submit(); });
      assert.equal(requests.length, 1, 'same-session submissions share a synchronous pending guard');
      if (transition === 'reopen') {
        await act(async () => tree.root.findByType('Sheet').props.onOpenChange(false));
        await act(async () => tree.root.findByType('Sheet').props.onOpenChange(true));
      } else {
        if (transition === 'client') client = secondClient;
        else projectId = 'b';
        await act(async () => tree.update(render()));
      }
      await change('Task B');
      await act(async () => { void submit(); });
      assert.equal(requests.length, 2, 'a new editor or identity can start its own submission');
      assert.equal(requests[1].projectId, projectId);
      await act(async () => fails ? requests[0].reject(new Error('obsolete failure')) : requests[0].resolve({}));
      assert.equal(title().props.value, 'Task B');
      assert.equal(tree.root.findByType('Sheet').props.open, true);
      assert.equal(disabled(), true, 'old completion cannot release the newer pending submission');
      assert.deepEqual(globalThis.projectsFormMessages, [], 'old responses cannot toast in the current editor');
      assert.equal(globalThis.projectsFormRefreshes, !fails && transition !== 'client' ? 1 : 0);
      await act(async () => requests[1].reject(new Error('current failure')));
      assert.equal(title().props.value, 'Task B');
      assert.equal(disabled(), false);
      assert.deepEqual(globalThis.projectsFormMessages, ['current failure']);
      await act(async () => { void submit(); });
      assert.equal(requests.length, 3);
      await act(async () => requests[2].resolve({}));
      assert.equal(tree.root.findByType('Sheet').props.open, false);
      assert.equal(title().props.value, '');
      await act(async () => tree.unmount());
    }
  }
  for (const fails of [false, true]) {
    const pending = deferred();
    globalThis.projectsFormRefreshes = 0;
    globalThis.projectsFormMessages = [];
    const client = { createTask: () => pending.promise };
    let tree;
    await act(async () => { tree = create(React.createElement(ProjectsUiProvider, { client }, detail
      ? React.createElement(ProjectTaskCreateSheet, { projectId: 'a', members: [], milestones: [], initialOpen: true })
      : React.createElement(CreateProjectTaskSheet, { projects: [{ id: 'a', name: 'A' }], initialOpen: true }))); });
    await act(async () => tree.root.findByProps({ id: detail ? 'task-create-title' : 'task-title' }).props.onChange({ target: { value: 'Unmounted task' } }));
    await act(async () => { void tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    await act(async () => tree.unmount());
    await act(async () => fails ? pending.reject(new Error('unmounted failure')) : pending.resolve({}));
    assert.equal(globalThis.projectsFormRefreshes, 0);
    assert.deepEqual(globalThis.projectsFormMessages, []);
  }
}
