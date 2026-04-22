import { Edit, SimpleForm } from '@/components/admin';
import { PeopleForm } from './PeopleForm';

export const PeopleEdit = () => (
  <Edit>
    <SimpleForm toolbar={null} className="max-w-6xl">
      <PeopleForm />
    </SimpleForm>
  </Edit>
);
