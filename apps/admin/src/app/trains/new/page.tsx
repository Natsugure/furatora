import { Title } from '@mantine/core';
import { TrainForm } from '@/components/TrainForm';

export default function NewTrainPage() {
  return (
    <div>
      <Title order={2} mb="lg">New Train</Title>
      <TrainForm />
    </div>
  );
}
