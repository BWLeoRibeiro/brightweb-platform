import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MarketingClient } from '../../packages/module-marketing/src/ui/marketing-client.tsx';
import { WorkflowWorkspace } from '../../packages/module-marketing/src/ui/workflow-workspace.tsx';
import { SocialMediaClient } from '../../packages/module-marketing/src/social-media/social-media-client.tsx';
import { defaultMarketingUiDictionary as dictionary } from '../../packages/module-marketing/src/ui/dictionary.ts';
import { MARKETING_EVENTS } from '../../packages/module-marketing/src/ui/events.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.marketingTestMessages = [];
globalThis.window = { confirm: () => true, setTimeout, clearTimeout, dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, location: {hash: ''}, history: {pushState() {}} };
const base = {subject:'Original subject',preheader:null,fromName:null,fromEmail:null,topicId:'topic',segmentId:null,bodyHtml:'<p>Original body</p>',bodyText:null,status:'draft',scheduledAt:null,sentAt:null,totalRecipients:1,sentCount:0,failedCount:0,createdAt:'2026-09-01T10:00:00Z',updatedAt:'2026-09-01T10:00:00Z'};
const a={...base,id:'a',name:'Campaign A'}, b={...base,id:'b',name:'Campaign B'};
const recipient={id:'ra',email:'fixture@example.invalid',status:'queued',contactId:'c',error:null,sentAt:null};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let tree;
const click=async(fn)=>act(async()=>{fn();});
const unmount=async()=>{if(tree)await act(async()=>tree.unmount());tree=null;};
const rows=()=>tree.root.findAll(n=>n.type==='button'&&n.props.className==='marketing-campaign-row');
const field=id=>tree.root.findByProps({id});
const sheet=()=>tree.root.findByType('Sheet');
const renderedText = node => typeof node === 'string' ? node : node.children.map(renderedText).join('');
const button = label => tree.root.findAll(n => n.type === 'Button' && renderedText(n) === label)[0];
async function campaigns(){
  globalThis.marketingTestMessages=[];
  const records=new Map([['a',structuredClone(a)],['b',structuredClone(b)]]);
  globalThis.marketingTestClient={
    getCampaign:async id=>records.get(id),listRecipients:async()=>[recipient],getCampaignAnalytics:async()=>null,getOverview:async()=>({}),
    querySegments:async()=>({items:[]}),queryCampaigns:async()=>({items:[...records.values()],total:records.size,totalPages:1}),listSegments:async()=>[],getSegment:async()=>null,
    updateCampaign:async(id,input)=>{const next={...records.get(id),...input};records.set(id,next);return next;},
  };
  await act(async()=>{tree=create(React.createElement(MarketingClient,{initialCampaigns:[a,b],initialTopics:[],initialSegments:[],initialWorkflows:[],initialOverview:{},initialCampaignAnalytics:{},initialCollectionsLoaded:true}));});
  return records;
}
try {
  for(const kind of ['recipient','campaign']) for(const fails of [false,true]) for(const destination of ['other', 'closed']){
    const records=await campaigns();const pending=deferred();
    globalThis.marketingTestClient[kind==='recipient'?'deleteRecipient':'deleteCampaign']=async()=>{await pending.promise;if(kind==='campaign')records.delete('a');else records.set('a',{...a,totalRecipients:0});};
    await click(()=>rows()[0].props.onClick());
    const deletion=kind==='recipient'?tree.root.findByProps({'aria-label':'Remover fixture@example.invalid'}):tree.root.findAll(n=>n.type==='Button'&&n.props.variant==='destructive')[0];
    await click(()=>deletion.props.onClick());
    await click(()=>sheet().props.onOpenChange(false));
    if (destination === 'other') {
      await click(()=>rows()[1].props.onClick());
      await click(()=>field('campaign-subject').props.onChange({target:{value:'B draft stays'}}));
    }
    await click(()=>fails?pending.reject(new Error('old failure')):pending.resolve());
    if (destination === 'other') {
      assert.equal(field('campaign-name').props.value,'Campaign B');
      assert.equal(field('campaign-subject').props.value,'B draft stays');
    }
    assert.equal(sheet().props.open, destination === 'other');
    assert.ok(!globalThis.marketingTestMessages.includes('old failure'));
    if(kind==='campaign')assert.equal(rows().length,fails?2:1);
    await unmount();
  }
  const records = await campaigns();
  const deletion = deferred();
  globalThis.marketingTestClient.deleteRecipient = async () => {
    await deletion.promise;
    records.set('a', {...a, totalRecipients: 0});
  };
  await click(() => rows()[0].props.onClick());
  await click(() => tree.root.findByProps({'aria-label': 'Remover fixture@example.invalid'}).props.onClick());
  await click(() => field('campaign-subject').props.onChange({target: {value: 'Unsaved while removing'}}));
  await click(() => deletion.resolve());
  assert.equal(field('campaign-subject').props.value, 'Unsaved while removing');
  assert.equal(tree.root.findAllByProps({'aria-label': 'Remover fixture@example.invalid'}).length, 0);
  await unmount();
  await campaigns();
  let sends=0;globalThis.marketingTestClient.sendCampaign=async()=>{sends++;return {...a,status:'sending'};};
  await click(()=>rows()[0].props.onClick());
  await click(()=>field('campaign-subject').props.onChange({target:{value:'Edited subject'}}));
  const send=()=>tree.root.findAll(n=>n.type==='Button'&&n.props.children===dictionary.editor.sendNow)[0];
  assert.equal(send().props.disabled,true);await click(()=>send().props.onClick());assert.equal(sends,0);
  const save=()=>button(dictionary.editor.save);
  await click(()=>save().props.onClick());assert.equal(send().props.disabled,false);
  await click(()=>send().props.onClick());assert.equal(sends,1);await unmount();

  await campaigns();
  let updates = 0, dispatches = 0;
  globalThis.marketingTestClient.updateCampaign = async () => { updates++; throw new Error('save unavailable'); };
  for (const method of ['sendCampaign', 'scheduleCampaign', 'sendTest']) {
    globalThis.marketingTestClient[method] = async () => { dispatches++; throw new Error('unexpected dispatch'); };
  }
  await click(() => rows()[0].props.onClick());
  await click(() => field('campaign-subject').props.onChange({target: {value: 'Draft after failed save'}}));
  await click(() => save().props.onClick());
  assert.equal(updates, 1);
  assert.equal(field('campaign-subject').props.value, 'Draft after failed save');
  await click(() => field('campaign-schedule').props.onChange({target: {value: '2026-12-01T10:00'}}));
  await click(() => field('campaign-test').props.onChange({target: {value: 'test@example.invalid'}}));
  for (const label of [dictionary.editor.sendNow, dictionary.editor.schedule, dictionary.editor.sendTest]) {
    assert.equal(button(label).props.disabled, true);
    await click(() => button(label).props.onClick());
  }
  assert.equal(dispatches, 0);
  await click(() => sheet().props.onOpenChange(false));
  await click(() => globalThis.marketingTestActions.get(MARKETING_EVENTS.create)());
  assert.equal(field('campaign-name').props.value, '');
  assert.equal(button(dictionary.editor.sendNow).props.disabled, true);
  await click(() => button(dictionary.editor.sendNow).props.onClick());
  assert.equal(dispatches, 0);
  await unmount();

  for (const operation of ['save', 'send']) {
    const records = await campaigns();
    const response = deferred();
    globalThis.marketingTestClient[operation === 'save' ? 'updateCampaign' : 'sendCampaign'] = async (id, input) => {
      await response.promise;
      const updated = {...records.get(id), ...(operation === 'save' ? input : {status: 'sending'})};
      records.set(id, updated);
      return updated;
    };
    await click(() => rows()[0].props.onClick());
    if (operation === 'save') await click(() => field('campaign-name').props.onChange({target: {value: 'Saved after closing'}}));
    await click(() => button(operation === 'save' ? dictionary.editor.save : dictionary.editor.sendNow).props.onClick());
    await click(() => sheet().props.onOpenChange(false));
    await click(() => rows()[1].props.onClick());
    await click(() => field('campaign-subject').props.onChange({target: {value: 'Current editor draft'}}));
    await click(() => response.resolve());
    assert.equal(field('campaign-name').props.value, 'Campaign B');
    assert.equal(field('campaign-subject').props.value, 'Current editor draft');
    assert.ok(renderedText(rows()[0]).includes(operation === 'save' ? 'Saved after closing' : dictionary.statuses.sending));
    await unmount();
  }

  let created=0,nodeAttempts=0;const savedIds=[];
  globalThis.marketingTestClient={
    createWorkflow:async input=>{created++;return {...input,id:'workflow-1',status:'draft',nodes:[],nodeCount:0,runCount:0,createdAt:base.createdAt,updatedAt:base.updatedAt};},
    updateWorkflow:async(id,input)=>({...input,id,status:'draft',nodes:[],nodeCount:0,runCount:0}),
    saveWorkflowNodes:async(id)=>{savedIds.push(id);nodeAttempts++;if(nodeAttempts===1)throw new Error('node save failed');return [];},
  };
  const props={initialWorkflows:[],dictionary,createRequest:0};
  await act(async()=>{tree=create(React.createElement(WorkflowWorkspace,props));});
  await act(async()=>tree.update(React.createElement(WorkflowWorkspace,{...props,createRequest:1})));
  await click(()=>field('workflow-name').props.onChange({target:{value:'Welcome'}}));
  await click(()=>field('workflow-trigger-value').props.onChange({target:{value:'news'}}));
  const saveWorkflow=()=>button(dictionary.workflows.save) ?? button(dictionary.workflows.saving);
  await click(()=>saveWorkflow().props.onClick());await click(()=>saveWorkflow().props.onClick());
  assert.equal(created,1);assert.deepEqual(savedIds,['workflow-1','workflow-1']);await unmount();

  let creationAttempts = 0, savedAfterFailure = 0;
  globalThis.marketingTestClient = {
    createWorkflow: async input => {
      creationAttempts++;
      if (creationAttempts === 1) throw new Error('create unavailable');
      return {...input, id: 'recovered', status: 'draft', nodes: [], nodeCount: 0, runCount: 0};
    },
    saveWorkflowNodes: async id => { assert.equal(id, 'recovered'); savedAfterFailure++; return []; },
  };
  await act(async () => { tree = create(React.createElement(WorkflowWorkspace, props)); });
  await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...props, createRequest: 1})));
  await click(() => field('workflow-name').props.onChange({target: {value: 'Recoverable draft'}}));
  await click(() => field('workflow-trigger-value').props.onChange({target: {value: 'news'}}));
  await click(() => saveWorkflow().props.onClick());
  assert.equal(field('workflow-name').props.value, 'Recoverable draft');
  assert.equal(savedAfterFailure, 0);
  await click(() => saveWorkflow().props.onClick());
  assert.equal(creationAttempts, 2);
  assert.equal(savedAfterFailure, 1);
  await unmount();

  const pendingCreate = deferred(); const pendingNodes = deferred(); let simultaneousCreates = 0;
  globalThis.marketingTestClient = {
    createWorkflow: () => { simultaneousCreates++; return pendingCreate.promise; },
    saveWorkflowNodes: () => pendingNodes.promise,
  };
  await act(async () => { tree = create(React.createElement(WorkflowWorkspace, props)); });
  await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...props, createRequest: 1})));
  await click(() => field('workflow-name').props.onChange({target: {value: 'Concurrent save'}}));
  await click(() => field('workflow-trigger-value').props.onChange({target: {value: 'news'}}));
  await click(() => { saveWorkflow().props.onClick(); saveWorkflow().props.onClick(); });
  assert.equal(simultaneousCreates, 1, 'one pending workflow creation owns duplicate callbacks');
  await act(async () => pendingCreate.resolve({id:'concurrent',name:'Concurrent save',triggerType:'contact_subscribed',triggerConfig:{topicId:'news'},status:'draft',nodes:[],nodeCount:0,runCount:0}));
  await click(() => button(dictionary.workflows.steps.add).props.onClick());
  const subjects = () => tree.root.findAll(n => n.type === 'Input' && n.props.id?.startsWith('workflow-subject-'));
  assert.equal(subjects().length, 1);
  await click(() => subjects()[0].props.onChange({target:{value:'Added while saving'}}));
  await act(async () => pendingNodes.resolve([]));
  assert.equal(subjects().length, 1, 'completed save cannot erase a newer node draft');
  assert.equal(subjects()[0].props.value, 'Added while saving');
  await unmount();

  const workflowDraft = {id:'draft',name:'Original workflow',triggerType:'contact_subscribed',triggerConfig:{topicId:'news'},status:'draft',nodes:[],nodeCount:0,runCount:0};
  const persistedNodes = deferred(); const nodeInputs = [];
  globalThis.marketingTestClient = {
    createWorkflow: async () => workflowDraft,
    updateWorkflow: async () => workflowDraft,
    saveWorkflowNodes: (_id, nodes) => { nodeInputs.push(nodes); return nodeInputs.length === 1 ? persistedNodes.promise : Promise.resolve([]); },
  };
  await act(async () => { tree = create(React.createElement(WorkflowWorkspace, props)); });
  await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...props, createRequest:1})));
  await click(() => field('workflow-name').props.onChange({target:{value:'Node identity'}}));
  await click(() => field('workflow-trigger-value').props.onChange({target:{value:'news'}}));
  await click(() => tree.root.findByProps({'aria-label':dictionary.workflows.steps.add}).props.onChange({target:{value:'wait'}}));
  await click(() => button(dictionary.workflows.steps.add).props.onClick());
  await click(() => saveWorkflow().props.onClick());
  await click(() => field('workflow-name').props.onChange({target:{value:'New name while saving'}}));
  await act(async () => persistedNodes.resolve([{id:'saved-node',workflowId:'draft',position:0,type:'wait',config:{durationMinutes:60}}]));
  assert.equal(field('workflow-name').props.value, 'New name while saving');
  await click(() => saveWorkflow().props.onClick());
  assert.equal(nodeInputs[1][0].id, 'saved-node', 'draft revisions retain newly assigned persistence identity');
  await unmount();

  const pendingDetail = deferred();
  globalThis.marketingTestClient = { getWorkflow: () => pendingDetail.promise, listWorkflowRuns: async () => [] };
  await act(async () => { tree = create(React.createElement(WorkflowWorkspace, {...props, initialWorkflows:[workflowDraft]})); });
  await click(() => tree.root.findByProps({className:'p-5 text-left'}).props.onClick());
  await click(() => field('workflow-name').props.onChange({target:{value:'New typing during load'}}));
  await act(async () => pendingDetail.resolve(workflowDraft));
  assert.equal(field('workflow-name').props.value, 'New typing during load');
  const pendingWorkflowSave = deferred();
  globalThis.marketingTestClient.updateWorkflow = () => pendingWorkflowSave.promise;
  await click(() => saveWorkflow().props.onClick());
  globalThis.marketingTestClient = {};
  await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...props, initialWorkflows:[workflowDraft]})));
  await act(async () => pendingWorkflowSave.resolve({...workflowDraft,name:'Old client result'}));
  assert.equal(sheet().props.open, false, 'client replacement detaches the workflow editor');
  assert.ok(!renderedText(tree.root.findByProps({className:'p-5 text-left'})).includes('Old client result'));
  await unmount();

  // Closing a draft detaches editor updates, not the captured persistence command.
  const workflowCards = () => tree.root.findAllByProps({className: 'p-5 text-left'});
  const workflowA = {...workflowDraft, id: 'workflow-a', name: 'Workflow A'};
  const workflowB = {...workflowDraft, id: 'workflow-b', name: 'Workflow B'};
  const savedNode = {id: 'persisted-wait', workflowId: workflowA.id, position: 0, type: 'wait', config: {durationMinutes: 60}};
  for (const stage of ['metadata', 'nodes']) for (const destination of ['closed', 'same', 'other', 'create', 'client']) {
    const metadata = deferred(), nodeSave = deferred();
    const records = new Map([[workflowA.id, workflowA], [workflowB.id, workflowB]]);
    let nodeCalls = 0, mutations = 0, updates = 0;
    const originalClient = {
      getWorkflow: async id => records.get(id), listWorkflowRuns: async () => [],
      updateWorkflow: async (_id, input) => {
        updates++;
        await metadata.promise;
        const updated = {...workflowA, ...input};
        records.set(workflowA.id, updated);
        return updated;
      },
      saveWorkflowNodes: async (id, inputs) => {
        nodeCalls++;
        assert.equal(id, workflowA.id);
        assert.equal(inputs.length, 1);
        assert.equal(inputs[0].config.durationMinutes, 60);
        await nodeSave.promise;
        records.set(id, {...records.get(id), nodes: [savedNode], nodeCount: 1});
        return [savedNode];
      },
    };
    globalThis.marketingTestClient = originalClient;
    const scenarioProps = {...props, initialWorkflows: [workflowA, workflowB], onMutated: () => mutations++};
    await act(async () => { tree = create(React.createElement(WorkflowWorkspace, scenarioProps)); });
    await click(() => workflowCards()[0].props.onClick());
    await click(() => tree.root.findByProps({'aria-label':dictionary.workflows.steps.add}).props.onChange({target:{value:'wait'}}));
    await click(() => button(dictionary.workflows.steps.add).props.onClick());
    await click(() => field('workflow-name').props.onChange({target:{value:'Persisted A'}}));
    await click(() => { saveWorkflow().props.onClick(); saveWorkflow().props.onClick(); });
    assert.equal(updates, 1);
    if (stage === 'nodes') await click(() => metadata.resolve());
    await click(() => sheet().props.onOpenChange(false));
    if (destination === 'same' || destination === 'other') {
      await click(() => workflowCards()[destination === 'same' ? 0 : 1].props.onClick());
    } else if (destination === 'create') {
      await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...scenarioProps, createRequest: 1})));
    } else if (destination === 'client') {
      globalThis.marketingTestClient = { getWorkflow: async () => workflowB, listWorkflowRuns: async () => [] };
      await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...scenarioProps, initialWorkflows:[workflowB]})));
      await click(() => workflowCards()[0].props.onClick());
    }
    if (destination !== 'closed') {
      await click(() => field('workflow-name').props.onChange({target:{value:'New editor typing'}}));
      if (destination !== 'client') {
        assert.equal(saveWorkflow().props.disabled, true, 'the client command stays pending after reopen');
        await click(() => saveWorkflow().props.onClick());
        assert.equal(updates, 1);
      }
    }
    await click(() => metadata.resolve());
    assert.equal(nodeCalls, 1, 'closing during metadata saving cannot skip captured node persistence');
    const beforeCompletion = mutations;
    await click(() => nodeSave.resolve());
    assert.equal(mutations, destination === 'client' ? beforeCompletion : 2);
    assert.equal(records.get(workflowA.id).nodes[0].id, savedNode.id);
    if (destination !== 'closed') {
      assert.equal(field('workflow-name').props.value, 'New editor typing');
      assert.equal(sheet().props.open, true);
      assert.equal(saveWorkflow().props.disabled, false, 'settlement releases the command guard');
    } else {
      assert.equal(sheet().props.open, false);
      await click(() => workflowCards()[0].props.onClick());
      assert.equal(tree.root.findAll(n => n.type === 'Input' && n.props.id?.startsWith('workflow-duration-')).length, 1);
    }
    if (destination === 'client') assert.equal(workflowCards().length, 1);
    else assert.ok(renderedText(workflowCards()[0]).includes(dictionary.workflows.nodeCount(1)));
    await unmount();
  }

  for (const action of ['activate', 'pause', 'delete']) for (const fails of [false, true]) for (const destination of ['closed', 'other', 'client']) {
    const pending = deferred(); let mutations = 0, calls = 0;
    const start = {...workflowA, status: action === 'pause' ? 'active' : 'draft'};
    globalThis.marketingTestMessages = [];
    globalThis.marketingTestClient = {
      getWorkflow: async id => id === start.id ? start : workflowB, listWorkflowRuns: async () => [],
      [action === 'delete' ? 'deleteWorkflow' : action === 'activate' ? 'activateWorkflow' : 'pauseWorkflow']: () => { calls++; return pending.promise; },
    };
    const scenarioProps = {...props, initialWorkflows: [start, workflowB], onMutated: () => mutations++};
    await act(async () => { tree = create(React.createElement(WorkflowWorkspace, scenarioProps)); });
    await click(() => workflowCards()[0].props.onClick());
    const actionButton = button(dictionary.workflows[action]);
    await click(() => { actionButton.props.onClick(); actionButton.props.onClick(); });
    assert.equal(calls, 1);
    await click(() => sheet().props.onOpenChange(false));
    if (destination === 'client') {
      globalThis.marketingTestClient = {getWorkflow: async () => workflowB, listWorkflowRuns: async () => []};
      await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...scenarioProps, initialWorkflows:[workflowB]})));
    }
    if (destination !== 'closed') {
      await click(() => workflowCards()[destination === 'client' ? 0 : 1].props.onClick());
      await click(() => field('workflow-name').props.onChange({target:{value:'Preserved draft B'}}));
    }
    await click(() => fails ? pending.reject(new Error('detached workflow failure')) : pending.resolve({...start, status:action === 'activate' ? 'active' : 'paused'}));
    assert.equal(mutations, !fails && destination !== 'client' ? 1 : 0);
    assert.equal(workflowCards().length, destination === 'client' ? 1 : action === 'delete' && !fails ? 1 : 2);
    if (destination !== 'client' && action !== 'delete' && !fails) {
      assert.ok(renderedText(workflowCards()[0]).includes(dictionary.workflows.statuses[action === 'activate' ? 'active' : 'paused']));
    }
    assert.ok(!globalThis.marketingTestMessages.includes('detached workflow failure'));
    if (destination !== 'closed') {
      assert.equal(sheet().props.open, true);
      assert.equal(field('workflow-name').props.value, 'Preserved draft B');
      assert.equal(saveWorkflow().props.disabled, false);
    } else assert.equal(sheet().props.open, false);
    await unmount();
  }

  for (const failedStage of ['metadata', 'nodes']) {
    const pending = deferred(); let attempts = 0, nodeAttempts = 0;
    globalThis.marketingTestMessages = [];
    globalThis.marketingTestClient = {
      getWorkflow: async () => workflowA, listWorkflowRuns: async () => [],
      updateWorkflow: async () => {
        attempts++;
        if (failedStage === 'metadata' && attempts === 1) await pending.promise;
        return workflowA;
      },
      saveWorkflowNodes: async () => {
        nodeAttempts++;
        if (failedStage === 'nodes' && nodeAttempts === 1) await pending.promise;
        return [];
      },
    };
    const scenarioProps = {...props, initialWorkflows: [workflowA]};
    await act(async () => { tree = create(React.createElement(WorkflowWorkspace, scenarioProps)); });
    await click(() => workflowCards()[0].props.onClick());
    await click(() => saveWorkflow().props.onClick());
    await click(() => sheet().props.onOpenChange(false));
    await click(() => workflowCards()[0].props.onClick());
    await click(() => field('workflow-name').props.onChange({target:{value:'Retry draft survives'}}));
    await click(() => pending.reject(new Error('old save failed')));
    assert.equal(saveWorkflow().props.disabled, false);
    assert.equal(field('workflow-name').props.value, 'Retry draft survives');
    assert.ok(!globalThis.marketingTestMessages.includes('old save failed'));
    await click(() => saveWorkflow().props.onClick());
    assert.equal(attempts, 2, 'a detached failure releases the synchronous guard for retry');
    assert.equal(nodeAttempts, failedStage === 'nodes' ? 2 : 1);
    await unmount();
  }

  const oldClientSave = deferred(), newClientSave = deferred();
  let replacementUpdates = 0, oldClientNodeCalls = 0;
  globalThis.marketingTestClient = {
    getWorkflow: async () => workflowA, listWorkflowRuns: async () => [],
    updateWorkflow: () => oldClientSave.promise,
    saveWorkflowNodes: async () => { oldClientNodeCalls++; return []; },
  };
  const clientSwapProps = {...props, initialWorkflows: [workflowA]};
  await act(async () => { tree = create(React.createElement(WorkflowWorkspace, clientSwapProps)); });
  await click(() => workflowCards()[0].props.onClick());
  await click(() => saveWorkflow().props.onClick());
  globalThis.marketingTestClient = {
    getWorkflow: async () => workflowB, listWorkflowRuns: async () => [],
    updateWorkflow: () => { replacementUpdates++; return newClientSave.promise; },
    saveWorkflowNodes: async () => [],
  };
  await act(async () => tree.update(React.createElement(WorkflowWorkspace, {...clientSwapProps, initialWorkflows:[workflowB]})));
  await click(() => workflowCards()[0].props.onClick());
  await click(() => saveWorkflow().props.onClick());
  await click(() => oldClientSave.resolve(workflowA));
  assert.equal(oldClientNodeCalls, 1, 'client replacement cannot redirect or interrupt captured node persistence');
  assert.equal(saveWorkflow().props.disabled, true, 'an old client cannot release the replacement command guard');
  await click(() => saveWorkflow().props.onClick());
  assert.equal(replacementUpdates, 1);
  await click(() => newClientSave.resolve(workflowB));
  assert.equal(saveWorkflow().props.disabled, false);
  assert.equal(workflowCards().length, 1);
  assert.equal(field('workflow-name').props.value, workflowB.name);
  await unmount();

  const event={id:'one',date:'2026-04-01',type:'social',title:'Original title',channels:'LinkedIn',baseText:'Original copy',references:[]};
  const empty={title:'Fixture',period:'2026',sections:[{id:'calendario',title:'Calendar'}],types:{},events:[]};
  const populated={...empty,types:{social:{label:'Post',medium:'social',tone:'green'}},events:[event]};
  await act(async()=>{tree=create(React.createElement(SocialMediaClient,{plan:empty}));});
  await act(async()=>tree.update(React.createElement(SocialMediaClient,{plan:populated})));
  const publications=()=>tree.root.findAll(n=>n.type==='button'&&n.props.className?.includes('social-event'));
  assert.equal(publications().length,1);
  await click(()=>publications()[0].props.onClick());assert.equal(sheet().props.open,true);
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const pendingCopy = deferred();
  Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{clipboard:{writeText:()=>pendingCopy.promise}}});
  await click(() => tree.root.findByProps({title:'Texto-base'}).props.aside.props.onClick());

  await act(async()=>tree.update(React.createElement(SocialMediaClient,{plan:{...populated,events:[{...event,title:'Updated title',baseText:'Updated copy'}]}})));
  assert.deepEqual(tree.root.findByProps({className:'social-draft-text'}).children, ['Updated copy']);
  await act(async () => pendingCopy.resolve());
  assert.deepEqual(tree.root.findByProps({className:'social-copy-status text-meta'}).children, [], 'old clipboard completion cannot claim newer text was copied');
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;

  await act(async()=>tree.update(React.createElement(SocialMediaClient,{plan:{...populated,events:[{...event,date:'2026-06-01'}]}})));
  assert.equal(publications().length,1);
  await act(async()=>tree.update(React.createElement(SocialMediaClient,{plan:empty})));
  assert.equal(sheet().props.open,false);
  await act(async()=>tree.update(React.createElement(SocialMediaClient,{plan:populated})));
  assert.equal(sheet().props.open,false);assert.equal(publications().length,1);
  await unmount();
  console.log('Campaign response ownership, dirty dispatch, workflow command ownership/retry and social prop replacement passed.');
} finally { await unmount(); }
