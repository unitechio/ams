import { useParams } from 'react-router-dom';
import { AuthClientEditor } from '@/components/auth-clients/AuthClientEditor';

export default function EditAuthClientPage() {
  const { id } = useParams();
  return <AuthClientEditor mode="all" clientId={Number(id)} />;
}
