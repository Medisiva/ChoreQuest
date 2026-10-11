import type {Task} from '../types';
export function questRewardLabel(task: Pick<Task,'isMilestone'|'starValue'|'starsPerStep'|'milestoneBonus'|'milestoneSteps'>): string {
 if(task.isMilestone)return `${task.starsPerStep ?? 0} stars per step · ${task.milestoneSteps ?? 1} steps · ${task.milestoneBonus ?? 0} completion bonus`;
 return `${task.starValue} ${task.starValue===1?'star':'stars'}`;
}
