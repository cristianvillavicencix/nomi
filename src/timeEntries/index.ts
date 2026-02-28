import { TimeEntriesCreate } from './TimeEntriesCreate';
import { TimeEntriesBulkCreateModal } from './TimeEntriesBulkCreateModal';
import { TimeEntriesEdit } from './TimeEntriesEdit';
import { TimeEntriesList } from './TimeEntriesList';

export default {
  list: TimeEntriesList,
  create: TimeEntriesCreate,
  edit: TimeEntriesEdit,
  options: {
    label: 'Hours',
  },
};

export { TimeEntriesBulkCreateModal };
