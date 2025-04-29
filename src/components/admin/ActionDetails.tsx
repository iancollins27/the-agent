import React from 'react';
import { ActionRecord } from './types';
import { formatDistanceToNow } from 'date-fns';

interface ActionDetailsProps {
  action: ActionRecord;
  onClose: () => void;
}

const ActionDetails: React.FC<ActionDetailsProps> = ({ action, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Action Details
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">
              <strong>Action Type:</strong> {action.action_type}
            </p>
            <p><strong>Status:</strong> {action.status}</p>
            <p><strong>Message:</strong> {action.message || 'No message'}</p>
            <p><strong>Requires Approval:</strong> {action.requires_approval ? 'Yes' : 'No'}</p>
            <p><strong>Created At:</strong> {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}</p>
            <p><strong>Executed At:</strong> {action.executed_at ? formatDistanceToNow(new Date(action.executed_at), { addSuffix: true }) : 'Not yet executed'}</p>
            <p><strong>Recipient:</strong> {action.recipient_name || 'No recipient'}</p>
            <p><strong>Sender:</strong> {action.sender_name || 'No sender'}</p>
            <p><strong>Project:</strong> {action.project_name || 'No project'}</p>
            <p><strong>Approver:</strong> {action.approver_id || 'No approver assigned'}</p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md width-full shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionDetails;
