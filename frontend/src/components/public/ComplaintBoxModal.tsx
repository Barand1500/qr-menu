import SofraFeedbackSheet, { type FeedbackProps } from './sofra/SofraFeedbackSheet';
export default function ComplaintBoxModal(props: FeedbackProps) {
  return <SofraFeedbackSheet {...props} kind="complaint" />;
}
