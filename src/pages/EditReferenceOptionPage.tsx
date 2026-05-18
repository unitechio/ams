import { useParams } from 'react-router-dom';
import { ReferenceOptionEditor } from '@/components/security/ReferenceOptionEditor';

export default function EditReferenceOptionPage() {
  const { id } = useParams<{ id: string }>();
  return <ReferenceOptionEditor optionId={Number(id)} />;
}
