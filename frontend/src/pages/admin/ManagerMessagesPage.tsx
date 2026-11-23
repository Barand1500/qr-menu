import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import FeedbackInbox from '@/components/admin/feedback/FeedbackInbox';
import { PageHeader } from '@/components/ui';
export default function ManagerMessagesPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role !== 'admin')
    return (
      <div>
        <PageHeader title="Yönetici Mesajları" />
        <p role="alert">
          <ShieldCheck size={20} /> Bu alan yalnızca yöneticilere açıktır.
        </p>
      </div>
    );
  return <FeedbackInbox kind="manager" />;
}
