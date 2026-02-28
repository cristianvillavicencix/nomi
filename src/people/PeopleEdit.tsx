import { Edit, SimpleForm } from '@/components/admin';
import { PeopleForm } from './PeopleForm';

export const PeopleEdit = () => (
  <Edit>
    <SimpleForm>
      <PeopleForm />
    </SimpleForm>
  </Edit>
);
