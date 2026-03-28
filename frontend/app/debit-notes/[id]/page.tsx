'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '../../lib/api'
import AppLoader from '../../components/AppLoader'
import AppModal from '../../components/AppModal'

export default function DebitNoteDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [note, setNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [showIssueConfirm, setShowIssueConfirm] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    api.get(`/debit-notes/${id}`)
      .then((res) => setNote(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleIssue = async () => {
    setShowIssueConfirm(true)
  }

  const confirmIssue = async () => {
    setShowIssueConfirm(false)
    setIssuing(true)
    try {
      await api.post(`/debit-notes/${id}/issue`)
      const res = await api.get(`/debit-notes/${id}`)
      setNote(res.data)
    } catch (e: any) {
      setModalError(e.response?.data?.message || 'Failed to issue')
    } finally {
      setIssuing(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/debit-notes/${id}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${note?.noteNumber || 'debit-note'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setModalError(e.response?.data?.message || 'Failed to download PDF')
    }
  }

  if (loading || !note) return <AppLoader />

  const isIssued = note.status === 'issued'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/debit-notes" className="text-gray-600 hover:text-gray-900">← Debit Notes</Link>
          <div className="flex items-center gap-3">
            {isIssued && (
              <button onClick={handleDownloadPdf} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50">
                Download PDF
              </button>
            )}
            {!isIssued && (
              <button onClick={handleIssue} disabled={issuing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {issuing ? 'Issuing...' : 'Issue Debit Note'}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Debit Note {note.noteNumber}</h1>
          <p className="text-gray-600">Original invoice: {note.originalInvoice?.invoiceNumber}</p>
          <p className="text-gray-600">Date: {new Date(note.issueDateTime).toLocaleString()}</p>
          <p className="text-gray-600">Status: <span className={isIssued ? 'text-green-600' : 'text-yellow-600'}>{note.status}</span></p>
          {note.reason && <p className="text-gray-600 mt-2">Reason: {note.reason}</p>}
          <div className="mt-4">
            <h2 className="font-semibold text-gray-900">Items</h2>
            <ul className="mt-2 space-y-1">
              {note.items?.map((item: any) => (
                <li key={item.id} className="text-gray-700">
                  {item.name} — Qty {item.quantity} × {Number(item.unitPrice).toFixed(2)} SAR = {Number(item.lineTotal).toFixed(2)} SAR
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="font-semibold text-gray-900">Total: {Number(note.totalAmount ?? 0).toFixed(2)} SAR</p>
          </div>
        </div>
      </main>

      <AppModal
        isOpen={showIssueConfirm}
        title="Issue debit note?"
        message="Issue this debit note? It cannot be modified after issuing."
        onClose={() => setShowIssueConfirm(false)}
        onConfirm={confirmIssue}
        confirmText="Issue"
        cancelText="Cancel"
      />

      <AppModal
        isOpen={!!modalError}
        title="Something went wrong"
        message={modalError}
        onClose={() => setModalError('')}
      />
    </div>
  )
}
