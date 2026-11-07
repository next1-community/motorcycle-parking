export function publicFlow(phase){
 const current={registration:0,locked:1,drawn:1,selecting:2,completed:3}[phase]??0;
 const labels=['確認登記名單','抽籤與公布順位','依序選擇車位','確認分配結果'];
 const messages={registration:'目前：登記名單已公布。接下來將公開抽出選位順位。',locked:'目前：名單已鎖定，準備公開抽籤。',drawn:'目前：抽籤順位已公布。接下來依順位叫號選位。',selecting:'目前：依順位選位，由管理中心操作並請住戶核對。',completed:'本次選位已完成，請核對戶別及分配車位。'};
 return {current,labels,message:messages[phase]||messages.registration};
}
export function renderPublicFlow(phase){const {current,labels,message}=publicFlow(phase);return `<section class="public-flow" aria-label="現場作業流程"><ol>${labels.map((label,i)=>`<li class="${i<current?'done':i===current?'active':'upcoming'}" ${i===current?'aria-current="step"':''}><span class="flow-number" aria-hidden="true">${i<current?'✓':i+1}</span><div><b>${label}</b>${i<=current?`<small>${i<current?'已完成':'目前階段'}</small>`:''}</div>${i<labels.length-1?'<span class="flow-arrow" aria-hidden="true">→</span>':''}</li>`).join('')}</ol><p aria-live="polite">${message}</p></section>`;}
