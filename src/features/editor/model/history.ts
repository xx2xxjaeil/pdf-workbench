import type { EditorElement } from "./document";

export interface EditorHistory {
  past: EditorElement[][];
  present: EditorElement[];
  future: EditorElement[][];
  selectedId: string | null;
}

export type EditorAction =
  | { type: "add"; element: EditorElement }
  | { type: "update"; element: EditorElement }
  | { type: "remove"; id: string }
  | { type: "select"; id: string | null }
  | { type: "reset" }
  | { type: "undo" }
  | { type: "redo" };

export const initialHistory: EditorHistory = {
  past: [],
  present: [],
  future: [],
  selectedId: null,
};

function commit(
  state: EditorHistory,
  next: EditorElement[],
  selectedId = state.selectedId,
) {
  return {
    past: [...state.past.slice(-49), state.present],
    present: next,
    future: [],
    selectedId,
  };
}

export function editorHistoryReducer(
  state: EditorHistory,
  action: EditorAction,
): EditorHistory {
  switch (action.type) {
    case "add":
      return commit(
        state,
        [...state.present, action.element],
        action.element.id,
      );
    case "update": {
      const previous = state.present.find(
        (element) => element.id === action.element.id,
      );

      if (
        !previous ||
        JSON.stringify(previous) === JSON.stringify(action.element)
      ) {
        return state;
      }

      return commit(
        state,
        state.present.map((element) =>
          element.id === action.element.id ? action.element : element,
        ),
      );
    }
    case "remove":
      return commit(
        state,
        state.present.filter((element) => element.id !== action.id),
        state.selectedId === action.id ? null : state.selectedId,
      );
    case "select":
      return { ...state, selectedId: action.id };
    case "reset":
      return initialHistory;
    case "undo":
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        selectedId: null,
      };
    case "redo":
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        selectedId: null,
      };
  }
}
