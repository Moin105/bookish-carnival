'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '../../lib/api'
import AppLoader from '../../components/AppLoader'

export default function NewCreditNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId')

  const [invoice, setInvoice] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0, vatRate: 15 }])
  const [loading, setLoading] = useState(!!invoiceId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (invoiceId) {
      api.get(`/invoices/${invoiceId}`)
        .then((res) => {
          setInvoice(res.data)
          if (res.data.items?.length) {
            setItems(res.data.items.map((i: any) => ({
              name: i.name,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice),
              vatRate: i.vatRate ?? 15,
            })))
          }
        })
        .catch(() => setError('Invoice not found'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
      setError('Missing invoiceId. Open from an issued invoice.')
    }
  }, [invoiceId])

  const addLine = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, vatRate: 15 }])
  const updateItem = (i: number, field: string, value: string | number) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: value }
    setItems(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceId) return
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        originalInvoiceId: invoiceId,
        reason: reason.trim() || undefined,
        items: items.filter((r) => r.name.trim()).map((r) => ({
          name: r.name,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice),
          vatRate: Number(r.vatRate),
        })),
      }
      if (payload.items.length === 0) {
        setError('Add at least one item')
        setSubmitting(false)
        return
      }
      const res = await api.post('/credit-notes', payload)
      router.push(`/credit-notes/${res.data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create credit note')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <AppLoader />
  if (!invoiceId || error && !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8">
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error || 'Missing invoice'}</div>
        <Link href="/invoices" className="mt-4 inline-block text-blue-600">Back to Invoices</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href={`/invoices/${invoiceId}`} className="text-gray-600 hover:text-gray-900">← Back to Invoice</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">New Credit Note</h1>
        <p className="text-gray-600 mb-6">Against invoice {invoice?.invoiceNumber}</p>
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g. Return of goods" />
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Items</label>
              <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800">+ Add line</button>
            </div>
            {items.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input className="col-span-5 px-3 py-2 border rounded" placeholder="Name" value={row.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                <input type="number" min={1} className="col-span-2 px-3 py-2 border rounded" placeholder="Qty" value={row.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                <input type="number" min={0} step={0.01} className="col-span-2 px-3 py-2 border rounded" placeholder="Unit price" value={row.unitPrice || ''} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} />
                <input type="number" min={0} max={100} className="col-span-2 px-3 py-2 border rounded" placeholder="VAT %" value={row.vatRate} onChange={(e) => updateItem(i, 'vatRate', e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex justify-end space-x-4">
            <Link href={`/invoices/${invoiceId}`} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">Cancel</Link>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Credit Note'}</button>
          </div>
        </form>
      </main>
    </div>
  )
}
