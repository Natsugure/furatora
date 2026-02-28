import { Title } from '@mantine/core';
import { TrainForm } from '@/components/TrainForm';

export default function NewTrainPage() {
  return (
    <div>
      <Title order={2} mb="lg">新規列車</Title>
      <TrainForm />
    </div>
  );
}
