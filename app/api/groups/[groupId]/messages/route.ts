import { isUuid } from '../../../../../lib/groups/validation'
import { authenticated, failure, invalid, json } from '../../shared'

type Context = { params: Promise<{ groupId: string }> }
const maxImage = 1048576
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/png': bytes => [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value),
  'image/jpeg': bytes => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
  'image/webp': bytes => [82,73,70,70].every((value,index) => bytes[index] === value) && [87,69,66,80].every((value,index) => bytes[index+8] === value),
}

export async function GET(request: Request, context: Context) {
  return authenticated(async ({ supabase }) => {
    const { groupId } = await context.params
    if (!isUuid(groupId)) return invalid()
    const params = new URL(request.url).searchParams
    const before = params.get('before')
    const beforeId = params.get('beforeId')
    if ([...params.keys()].some(key => !['before','beforeId'].includes(key)) ||
      (!!before !== !!beforeId) || (before !== null && !Number.isFinite(Date.parse(before))) ||
      (beforeId !== null && !isUuid(beforeId))) return invalid()
    const { data, error } = await supabase.rpc('list_group_messages', {
      group_id: groupId, before_time: before ? new Date(before).toISOString() : null, before_id: beforeId,
    })
    return error ? failure(error) : json({ messages: data })
  })
}

export async function POST(request: Request, context: Context) {
  return authenticated(async ({ supabase }) => {
    const { groupId } = await context.params
    if (!isUuid(groupId)) return invalid()
    let form: FormData
    try { form = await request.formData() } catch { return invalid() }
    const entries = [...form.keys()]
    if (entries.length < 1 || entries.length > 2 || entries.some(key => !['text','image'].includes(key)) || entries.filter(key => key === 'text').length !== 1) return invalid()
    const raw = form.get('text')
    const file = form.get('image')
    if (typeof raw !== 'string' || (file !== null && !(file instanceof File))) return invalid()
    const message = raw.trim()
    if (message.length > 2000 || (!message && !file)) return invalid()
    let imageBytes: string | null = null
    let imageType: string | null = null
    if (file instanceof File) {
      if (file.size < 1 || file.size > maxImage || !Object.hasOwn(signatures,file.type)) return invalid()
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (!signatures[file.type](bytes)) return invalid()
      imageType = file.type
      imageBytes = `\\x${Buffer.from(bytes).toString('hex')}`
    }
    const { data, error } = await supabase.rpc('send_group_message', {
      group_id: groupId, message_text: message || null, image_type: imageType, image_bytes: imageBytes,
    })
    return error ? failure(error) : json({ message: data }, 201)
  })
}
