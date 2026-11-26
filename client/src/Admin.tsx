import { useState } from 'react'
import { Modal } from './Modal'
import { useQuery } from '@tanstack/react-query'
import { api, useAction } from './api'
import { Empty, ErrorBox, notify, Skeleton } from './ui'
import { formatTime, states, type State } from './model'

type Report = {
  id: number
  reason: string
  createdAt: string
  user: { name: string; email: string }
  item: {
    id: string
    title: string
    hiddenAt: string | null
    state: State
    decisions: { action: string; reason: string; createdAt: string }[]
  }
}

const choices: Record<string, string> = {
  hide: 'ซ่อนชั่วคราว',
  restore: 'เปิดคืน',
  close: 'ปิดประกาศ',
}

function ReportRow({
  item,
  reports,
  close,
}: {
  item: Report['item']
  reports: Report[]
  close: () => void
}) {
  const action = useAction()
  const options = item.hiddenAt ? ['restore', 'close'] : ['hide', 'close']

  return (
    <Modal title={item.title} close={close} busy={action.isPending}>
      <ul>
        {reports.map((report) => (
          <li key={report.id}>
            <strong>{report.user.name}</strong> · {report.user.email}
            <p>
              {formatTime(report.createdAt)} · {report.reason}
            </p>
          </li>
        ))}
      </ul>

      {item.decisions.map((decision, index) => (
        <p key={`${decision.createdAt}-${index}`}>
          {choices[decision.action]} · {decision.reason}
        </p>
      ))}

      {item.state !== 'CLOSED' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fields = Object.fromEntries(new FormData(e.currentTarget))

            action.mutate(
              {
                path: '/admin/items/' + item.id,
                method: 'PATCH',
                body: fields,
              },
              {
                onSuccess: () => {
                  notify('บันทึกผลการตรวจแล้ว')
                  close()
                },
              },
            )
          }}
        >
          <label>
            ผลการตรวจ
            <select name="action" key={String(item.hiddenAt)}>
              {options
                .filter(
                  (option) => !(option === 'close' && item.state === 'GIVEN'),
                )
                .map((option) => (
                  <option key={option} value={option}>
                    {choices[option]}
                  </option>
                ))}
            </select>
          </label>

          <label>
            เหตุผลของผู้ดูแล
            <textarea required name="reason" maxLength={500} />
          </label>

          <button className="secondary" disabled={action.isPending}>
            บันทึกผลการตรวจ
          </button>
        </form>
      )}

      <ErrorBox error={action.error} />
    </Modal>
  )
}

export default function Admin() {
  const [selected, setSelected] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['reports'],
    queryFn: () => api<Report[]>('/admin/reports'),
  })

  const reportsByItem = new Map<string, { latest: Report; reports: Report[] }>()

  for (const report of q.data ?? []) {
    const group = reportsByItem.get(report.item.id)

    if (group) {
      group.reports.push(report)
    } else {
      reportsByItem.set(report.item.id, { latest: report, reports: [report] })
    }
  }

  const current = selected ? reportsByItem.get(selected) : undefined
  return (
    <>
      <h1 className="page-title">ตรวจประกาศ</h1>

      {q.isPending ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : reportsByItem.size ? (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table management-table">
            <thead>
              <tr>
                <th scope="col">ประกาศ</th>
                <th scope="col">จำนวนรายงาน</th>
                <th scope="col">รายงานล่าสุด</th>
                <th scope="col">สถานะประกาศ</th>
                <th scope="col">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(reportsByItem.values(), ({ latest, reports }) => {
                const { item } = latest

                return (
                  <tr key={item.id}>
                    <td data-label="ประกาศ">{item.title}</td>
                    <td data-label="จำนวนรายงาน">{reports.length}</td>
                    <td data-label="รายงานล่าสุด">
                      {formatTime(latest.createdAt)}
                    </td>
                    <td data-label="สถานะ">
                      {item.hiddenAt ? 'ซ่อนอยู่' : states[item.state]}
                    </td>
                    <td data-label="จัดการ">
                      <button
                        className="secondary"
                        onClick={() => setSelected(item.id)}
                      >
                        ดูรายงานและจัดการ
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ยังไม่มีรายงานประกาศ</Empty>
      )}
      {current && (
        <ReportRow
          item={current.latest.item}
          reports={current.reports}
          close={() => setSelected(null)}
        />
      )}
    </>
  )
}
