import type { RaRecord } from 'ra-core';
import { PeopleCreate } from './PeopleCreate';
import { PeopleEdit } from './PeopleEdit';
import { PeopleList } from './PeopleList';

export default {
  list: PeopleList,
  create: PeopleCreate,
  edit: PeopleEdit,
  recordRepresentation: (record: RaRecord) =>
    `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim(),
  options: {
    label: 'Personal',
  },
};
