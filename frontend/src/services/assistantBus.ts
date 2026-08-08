export interface AssistantBusState {
  taskId: string | null;
  taskTitle: string | null;
}

type Listener = () => void;

let state: AssistantBusState = { taskId: null, taskTitle: null };
let openCounter = 0;
const listeners = new Set<Listener>();
const changeListeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const assistantBus = {
  requestOpen(task: AssistantBusState) {
    state = task;
    openCounter += 1;
    emit();
  },
  getState(): AssistantBusState {
    return state;
  },
  getOpenCounter(): number {
    return openCounter;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  notifyTasksChanged() {
    changeListeners.forEach((listener) => listener());
  },
  onTasksChanged(listener: Listener): () => void {
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  },
};
