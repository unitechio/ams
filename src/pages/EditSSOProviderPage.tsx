import { useParams } from 'react-router-dom';
import { SSOProviderEditor } from '@/components/security/SSOProviderEditor';

export default function EditSSOProviderPage() {
  const { id } = useParams<{ id: string }>();
  return <SSOProviderEditor providerId={Number(id)} />;
}
