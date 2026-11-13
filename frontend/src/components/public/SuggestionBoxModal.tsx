import SofraFeedbackSheet, { type FeedbackProps } from './sofra/SofraFeedbackSheet';
export default function SuggestionBoxModal(props: FeedbackProps) {
  return <SofraFeedbackSheet {...props} kind="suggestion" />;
}
