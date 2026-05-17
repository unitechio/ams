import { useParams } from 'react-router-dom';
import { AuthClientEditor } from '@/components/auth-clients/AuthClientEditor';

export default function EditServiceAccountPage() {
  const { id } = useParams();
  return <AuthClientEditor mode="service" clientId={Number(id)} />;
}
