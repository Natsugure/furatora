import { Title } from '@mantine/core';
import { OperatorForm } from '@/components/OperatorForm';

export default function NewOperatorPage() {
  return (
    <div>
      <Title order={2} mb="lg">新規事業者</Title>
      <OperatorForm />
    </div>
  );
}
