import { TimeEntriesCreate } from './TimeEntriesCreate';
import { TimeEntriesBulkCreateModal } from './TimeEntriesBulkCreateModal';
import { TimeEntriesEdit } from './TimeEntriesEdit';
import { TimeEntriesList } from './TimeEntriesList';
import { TimeEntriesShow } from './TimeEntriesShow';

export default {
  list: TimeEntriesList,
  create: TimeEntriesCreate,
  edit: TimeEntriesEdit,
  show: TimeEntriesShow,
  options: {
    label: 'Hours',
  },
};

export { TimeEntriesBulkCreateModal };
