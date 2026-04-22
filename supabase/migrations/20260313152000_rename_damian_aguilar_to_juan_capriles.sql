update public.sales
set first_name = 'Juan',
    last_name = 'Capriles'
where lower(coalesce(first_name, '')) in ('damian', 'damial')
  and lower(coalesce(last_name, '')) = 'aguilar';
