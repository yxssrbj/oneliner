import { isUuid } from '../../../../../../../lib/groups/validation'
import { authenticated, failure, invalid, json } from '../../../../shared'

export async function GET(_request: Request, context: { params: Promise<{ groupId: string; messageId: string }> }) {
  return authenticated(async ({ supabase }) => {
    const { groupId, messageId } = await context.params
    if (!isUuid(groupId) || !isUuid(messageId)) return invalid()
    const { data, error } = await supabase.rpc('read_group_image', { group_id: groupId, message_id: messageId })
    if (error) return failure(error)
    if (!Array.isArray(data) || data.length !== 1 || !['image/jpeg','image/png','image/webp'].includes(data[0].content_type) || typeof data[0].data_base64 !== 'string') return json({ error: 'Image unavailable.' }, 404)
    return new Response(new Uint8Array(Buffer.from(data[0].data_base64, 'base64')), {
      headers: { 'Content-Type': data[0].content_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  })
}
