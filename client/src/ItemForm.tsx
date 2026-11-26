import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAction, useDetail, useUser } from './api'
import { categories, conditions, type Detail } from './model'
import { ErrorBox, notify, Skeleton } from './ui'
import provinces from './data/province.json'
import districts from './data/district.json'

function localTime(date: string | null | undefined) {
  if (!date) return ''
  const value = new Date(date)
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
export function EditPage() {
  const { id = '' } = useParams(),
    item = useDetail(id)
  const me = useUser()
  return item.isPending ? (
    <Skeleton />
  ) : item.error ? (
    <ErrorBox error={item.error} retry={() => void item.refetch()} />
  ) : item.data.ownerId !== me.data?.user?.id ||
    item.data.hiddenAt ||
    ['GIVEN', 'CLOSED'].includes(item.data.state) ? (
    <div className="panel">คุณไม่สามารถแก้ไขประกาศนี้ได้</div>
  ) : (
    <ItemForm key={item.data.id} item={item.data} />
  )
}
export default function ItemForm({ item }: { item?: Detail }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [fileError, setFileError] = useState('')
  const [category, setCategory] = useState(item?.category ?? categories[0])
  const [province, setProvince] = useState(item?.province ?? '')
  const [district, setDistrict] = useState(item?.district ?? '')

  const selectedProvince = provinces.find((p) => p.name.th === province)
  const districtOptions = districts.filter(
    (d) => d.province_id === selectedProvince?.id,
  )
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function selectPhoto(selected: File | null) {
    let error = ''
    if (
      selected &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)
    ) {
      error = 'กรุณาเลือกรูป JPG, PNG หรือ WebP'
    } else if (selected && selected.size > 5 * 1024 * 1024) {
      error = 'กรุณาเลือกรูปขนาดไม่เกิน 5 MB'
    }
    setFileError(error)
    setFile(error ? null : selected)
  }
  const [bundle, setBundle] = useState(!!item?.contents),
    [scheduled, setScheduled] = useState(!!item?.endsAt),
    [problem, setProblem] = useState('')
  const action = useAction<{ id: string }>(),
    navigate = useNavigate()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fields = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >
    const iso = (value: string) =>
      value ? new Date(value).toISOString() : null
    const startsAt = scheduled ? iso(fields.startsAt) : null,
      endsAt = scheduled ? iso(fields.endsAt) : null
    if (
      scheduled &&
      (!startsAt ||
        !endsAt ||
        endsAt <= startsAt ||
        (!item && Date.parse(endsAt) <= Date.now()))
    ) {
      setProblem('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มและยังไม่ผ่านไป')
      return
    }
    setProblem('')
    if (fileError) return
    const data = {
      ...fields,
      rights: fields.rights === 'on',
      contents: bundle ? fields.contents : null,
      startsAt: item?.hasHistory ? item.startsAt : startsAt,
      endsAt: item?.hasHistory ? item.endsAt : endsAt,
    }
    const upload = new FormData()
    if (file) {
      upload.set('item', JSON.stringify(data))
      upload.set('photo', file)
    }
    try {
      const result = await action.mutateAsync({
        path: item ? '/items/' + item.id : '/items',
        method: item ? 'PUT' : 'POST',
        body: file ? upload : data,
      })
      notify('บันทึกประกาศแล้ว')
      navigate('/items/' + result.id)
    } catch {
      /* Show mutation error. */
    }
  }
  function field(
    label: string,
    name: string,
    initial = '',
    required = true,
    max = 140,
  ) {
    return (
      <label>
        {label}
        <input
          name={name}
          defaultValue={initial}
          required={required}
          maxLength={max}
        />
      </label>
    )
  }
  return (
    <section className="panel form-panel">
      <Link to="/mine" className="text-link">
        ประกาศของฉัน
      </Link>
      <h1>{item ? 'แก้ไขประกาศ' : 'ลงประกาศส่งต่อ'}</h1>
      <form onSubmit={submit}>
        <h2>รายละเอียดสิ่งของ</h2>
        {field('ชื่อสิ่งของ', 'title', item?.title)}
        <div className="form-row">
          <label>
            ประเภทประกาศ
            <select
              value={bundle ? 'bundle' : 'single'}
              onChange={(e) => setBundle(e.target.value === 'bundle')}
            >
              <option value="single">ชิ้นเดียว</option>
              <option value="bundle">เป็นชุด</option>
            </select>
          </label>
          <label>
            หมวดหมู่
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {bundle && (
          <label>
            ของที่อยู่ในชุด
            <textarea
              name="contents"
              required
              defaultValue={item?.contents || ''}
              maxLength={1800}
            />
          </label>
        )}
        <label>
          สภาพสิ่งของ
          <select name="condition" defaultValue={item?.condition || 'สภาพดี'}>
            {item && !conditions.includes(item.condition) && (
              <option>{item.condition}</option>
            )}
            {conditions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="photo-field">
          <label htmlFor="item-photo">รูปภาพสิ่งของ</label>
          {(preview || item?.image) && <img
            src={preview || item?.image}
            alt="ตัวอย่างรูปภาพประกาศ"
          />}
          <input
            id="item-photo"
            ref={fileInput}
            type="file"
            required={!item?.image}
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="photo-help"
            aria-invalid={!!fileError}
            onChange={(e) => selectPhoto(e.target.files?.[0] ?? null)}
          />
          <small id="photo-help">
            เลือก JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB
            {item
              ? ' · เลือกไฟล์ใหม่เพื่อเปลี่ยนรูปเดิม'
              : ' · ต้องแนบรูปสิ่งของก่อนลงประกาศ'}
          </small>
          {fileError && (
            <span role="alert" className="photo-error">
              {fileError}
            </span>
          )}
          {(file || fileError) && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (fileInput.current) fileInput.current.value = ''
                selectPhoto(null)
              }}
            >
              ยกเลิกรูปที่เลือก
            </button>
          )}
        </div>
        <label>
          รายละเอียด
          <textarea
            name="description"
            required
            maxLength={2500}
            defaultValue={item?.description}
          />
        </label>
        <h2>พื้นที่และการนัดรับ</h2>
        <div className="form-row">
          <label>
            จังหวัด
            <select
              name="province"
              required
              value={province}
              onChange={(e) => {
                setProvince(e.target.value)
                setDistrict('')
              }}
            >
              <option value="">เลือกจังหวัด</option>
              {item?.province && !provinces.some((p) => p.name.th === item.province) && (
                <option value={item.province}>{item.province} (ข้อมูลเดิม)</option>
              )}
              {provinces.map((p) => (
                <option key={p.id} value={p.name.th}>{p.name.th}</option>
              ))}
            </select>
          </label>

          <label>
            อำเภอ/เขต
            <select
              name="district"
              required
              disabled={!province}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">{province ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
              {item?.district &&
                province === item.province &&
                !districtOptions.some((d) => d.name.th === item.district) && (
                  <option value={item.district}>{item.district} (ข้อมูลเดิม)</option>
                )}
              {districtOptions.map((d) => (
                <option key={d.id} value={d.name.th}>{d.name.th}</option>
              ))}
            </select>
          </label>
        </div>
        {field('ชื่อชุมชน (ถ้ามี)', 'community', item?.community, false, 120)}
        {item?.hasHistory ? (
          <p>จัดการช่วงนัดรับที่หน้ารายละเอียด เพื่อแจ้งผู้ที่อยู่ในคิว</p>
        ) : (
          <label>
            รูปแบบนัดรับ
            <select
              value={scheduled ? 'window' : 'later'}
              onChange={(e) => setScheduled(e.target.value === 'window')}
            >
              <option value="later">นัดรับภายหลัง</option>
              <option value="window">กำหนดช่วงนัดรับ</option>
            </select>
          </label>
        )}
        {scheduled && (
          <div className="form-row">
            <label>
              เริ่มนัดรับ
              <input
                type="datetime-local"
                name="startsAt"
                readOnly={item?.hasHistory}
                defaultValue={localTime(item?.startsAt)}
                required
              />
            </label>
            <label>
              สิ้นสุดนัดรับ
              <input
                type="datetime-local"
                name="endsAt"
                readOnly={item?.hasHistory}
                defaultValue={localTime(item?.endsAt)}
                required
              />
            </label>
          </div>
        )}
        {field(
          'จุดนัดรับละเอียด',
          'pickupPoint',
          item?.pickup?.pickupPoint,
          true,
          400,
        )}
        {field(
          'ช่องทางติดต่อหนึ่งช่องทาง',
          'contact',
          item?.pickup?.contact,
          true,
          160,
        )}
        <small>แสดงให้เจ้าของและผู้รับที่ยืนยันสิทธิ์แล้วเท่านั้น</small>
        <label className="check">
          <input type="checkbox" name="rights" required />
          ฉันมีสิทธิ์ส่งต่อสิ่งของนี้โดยให้ฟรี
        </label>
        <ErrorBox error={problem ? new Error(problem) : action.error} />
        <button className="primary" disabled={action.isPending || !!fileError}>
          บันทึกประกาศ
        </button>
      </form>
    </section>
  )
}
