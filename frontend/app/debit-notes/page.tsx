'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '../lib/api'
import AppLoader from '../components/AppLoader'

interface DebitNote {
  id: string
  noteNumber: string
  issueDateTime: string
  status: string
  totalAmount: number
  originalInvoice?: { invoiceNumber: string }
  company?: { name: string }
  customer?: { name: string }
}

export default function DebitNotesPage() {
  const router = useRouter()
  const [notes, setNotes] = useState<DebitNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotes()
  }, [])

  const fetchNotes = async () => {
    try {
      const res = await api.get('/debit-notes')
      setNotes(res.data)
    } catch (e: any) {
      if (e.response?.status === 401) router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <AppLoader />

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">← Back to Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Debit Notes</h1>
        <p className="text-gray-600 mb-6">ZATCA Phase 1 debit notes (UBL 383)</p>
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {notes.map((n) => (
                <tr key={n.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{n.noteNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{n.originalInvoice?.invoiceNumber ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(n.issueDateTime).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{Number(n.totalAmount ?? 0).toFixed(2)} SAR</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${n.status === 'issued' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/debit-notes/${n.id}`} className="text-blue-600 hover:text-blue-900 text-sm">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {notes.length === 0 && (
            <div className="text-center py-12 text-gray-500">No debit notes yet. Create one from an issued invoice.</div>
          )}
        </div>
      </main>
    </div>
  )
}
