import { useParams } from 'react-router-dom';
import { LoginChannelEditor } from '@/components/security/LoginChannelEditor';

export default function EditLoginChannelPage() {
  const { id } = useParams<{ id: string }>();
  return <LoginChannelEditor channelId={Number(id)} />;
}
