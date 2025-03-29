
import { ActionRecord } from "../types";

export type ActionConfirmationProps = {
  action: ActionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onActionResolved: () => void;
};
