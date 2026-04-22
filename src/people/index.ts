import type { RaRecord } from 'ra-core';
import { PeopleCreate } from './PeopleCreate';
import { PeopleEdit } from './PeopleEdit';
import { PeopleList } from './PeopleList';
import { PeopleShow } from './PeopleShow';

export default {
  list: PeopleList,
  create: PeopleCreate,
  edit: PeopleEdit,
  show: PeopleShow,
  recordRepresentation: (record: RaRecord) =>
    `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim(),
  options: {
    label: 'People',
  },
};
