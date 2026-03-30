import { Button } from '../common/Button.jsx';
import { StatusBanner } from '../common/StatusBanner.jsx';

export function InterviewStatusBanner({ status, onConfirmEnd, onCancelEnd }) {
  if (!status) {
    return null;
  }

  if (status.type === 'confirm-end') {
    return (
      <StatusBanner
        variant="info"
        title="End interview?"
        message="This will mark the text interview as completed."
        actions={[
          <Button key="confirm" size="sm" variant="danger" onClick={onConfirmEnd}>Confirm End</Button>,
          <Button key="cancel" size="sm" variant="secondary" onClick={onCancelEnd}>Cancel</Button>,
        ]}
      />
    );
  }

  return <StatusBanner variant={status.type} title={status.title} message={status.message} />;
}
