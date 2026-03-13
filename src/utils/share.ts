export async function shareOrCopy(text: string, title = 'Chat invite'): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
