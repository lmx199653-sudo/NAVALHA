revoke all on function public.billing_account_status(uuid) from public, anon, authenticated;
revoke all on function public.billing_is_suspended(uuid) from public, anon, authenticated;
revoke all on function public.billing_register_usage() from public, anon, authenticated;
revoke all on function public.billing_block_when_suspended() from public, anon, authenticated;
revoke all on function public.public_shop_accepting(text) from public;
grant execute on function public.public_shop_accepting(text) to anon, authenticated;