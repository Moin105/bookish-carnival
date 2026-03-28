'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import api from '../../lib/api'
import AppModal from '../../components/AppModal'

interface InvoiceItem {
  id: string
  name: string
  description?: string
  quantity: number
  unitPrice: number
  vatRate: number
  vatAmount: number
  lineTotal: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  issueDateTime: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  status: string
  immutableFlag: boolean
  currentHash?: string
  previousHash?: string
  qrCode?: string
  pdfPath?: string
  company: {
    id: string
    name: string
    vatNumber: string
    address?: string
    city?: string
    email?: string
    phone?: string
  }
  customer: {
    id: string
    name: string
    type?: 'B2B' | 'B2C'
    email?: string
    phone?: string
    address?: string
    vatNumber?: string
  }
  items: InvoiceItem[]
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [showIssueConfirm, setShowIssueConfirm] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice()
    }
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const response = await api.get(`/invoices/${invoiceId}`)
      setInvoice(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/login')
      } else if (error.response?.status === 404) {
        setError('Invoice not found')
      } else {
        setError('Failed to load invoice')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleIssue = async () => {
    setShowIssueConfirm(true)
  }

  const confirmIssue = async () => {
    setShowIssueConfirm(false)
    setIssuing(true)
    try {
      await api.put(`/invoices/${invoiceId}/issue`, {})
      // Refresh invoice data
      await fetchInvoice()
    } catch (error: any) {
      setModalError(error.response?.data?.message || 'Failed to issue invoice')
    } finally {
      setIssuing(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice?.invoiceNumber || 'invoice'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setModalError(e.response?.data?.message || 'Failed to download PDF')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/invoices" className="text-gray-600 hover:text-gray-900">
              ← Back to Invoices
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Invoice not found'}
          </div>
        </main>
      </div>
    )
  }

  const canEdit = invoice.status === 'draft' && !invoice.immutableFlag
  const isIssued = invoice.status === 'issued'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/invoices" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Invoices</span>
            </Link>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'issued'
                  ? 'bg-green-100 text-green-800'
                  : invoice.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {invoice.status.toUpperCase()}
              </span>
              {canEdit && (
                <button
                  onClick={handleIssue}
                  disabled={issuing}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all font-medium disabled:opacity-50"
                >
                  {issuing ? 'Issuing...' : 'Issue Invoice'}
                </button>
              )}
              {isIssued && (
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Download PDF
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Invoice Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice</h1>
              <p className="text-gray-600">Invoice Number: {invoice.invoiceNumber}</p>
              <p className="text-gray-600">Date: {formatDate(invoice.issueDateTime)}</p>
            </div>
            {invoice.qrCode && (
              <div className="text-center">
                <div className="bg-white p-2 rounded border border-gray-200 inline-block">
                  <img src={invoice.qrCode} alt="QR Code" className="w-32 h-32" />
                </div>
                <p className="text-xs text-gray-500 mt-2">ZATCA QR Code</p>
              </div>
            )}
          </div>

          {/* Company and Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">From (Seller)</h3>
              <div className="text-gray-700">
                <p className="font-medium">{invoice.company.name}</p>
                <p>VAT: {invoice.company.vatNumber}</p>
                {invoice.company.address && <p>{invoice.company.address}</p>}
                {invoice.company.city && <p>{invoice.company.city}</p>}
                {invoice.company.email && <p>Email: {invoice.company.email}</p>}
                {invoice.company.phone && <p>Phone: {invoice.company.phone}</p>}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">To (Buyer)</h3>
              <div className="text-gray-700">
                <p className="font-medium">{invoice.customer.name}</p>
                {invoice.customer.vatNumber && <p>VAT: {invoice.customer.vatNumber}</p>}
                {invoice.customer.address && <p>{invoice.customer.address}</p>}
                {invoice.customer.email && <p>Email: {invoice.customer.email}</p>}
                {invoice.customer.phone && <p>Phone: {invoice.customer.phone}</p>}
              </div>
            </div>
          </div>

          {isIssued && invoice.currentHash && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                <strong>✓ Invoice Issued</strong> - This invoice is immutable and ZATCA Phase 1 compliant.
              </p>
              {invoice.currentHash && (
                <p className="text-xs text-green-700 mt-2 font-mono break-all">
                  Hash: {invoice.currentHash.substring(0, 32)}...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Invoice Items */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">VAT Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">VAT Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{item.vatRate}%</td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(item.vatAmount)}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>VAT Amount:</span>
                <span>{formatCurrency(invoice.vatAmount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold text-gray-900">
                <span>Total:</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Issue Credit / Debit Note (only for issued invoices) */}
        {isIssued && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Related documents</h3>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/credit-notes/new?invoiceId=${invoiceId}`}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm"
              >
                Issue Credit Note
              </Link>
              <Link
                href={`/debit-notes/new?invoiceId=${invoiceId}`}
                className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 font-medium text-sm"
              >
                Issue Debit Note
              </Link>
            </div>
          </div>
        )}
      </main>

      <AppModal
        isOpen={showIssueConfirm}
        title="Issue invoice?"
        message="Are you sure you want to issue this invoice? Once issued, it cannot be modified."
        onClose={() => setShowIssueConfirm(false)}
        onConfirm={confirmIssue}
        confirmText="Issue invoice"
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
