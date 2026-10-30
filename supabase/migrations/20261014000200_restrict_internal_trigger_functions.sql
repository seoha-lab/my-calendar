do $$
begin
  if to_regprocedure('public.daymo_create_user_defaults()') is not null then
    revoke all on function public.daymo_create_user_defaults() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
