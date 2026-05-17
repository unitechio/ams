import { useParams } from 'react-router-dom';
import { SecurityPolicyEditor } from '@/components/security/SecurityPolicyEditor';

export default function EditSecurityPolicyPage() {
  const { id } = useParams();
  return <SecurityPolicyEditor policyId={Number(id)} />;
}
