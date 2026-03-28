'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '../lib/api'
import zatcaLogo from '../images/logo.png'
import AppLoader from '../components/AppLoader'
import AppModal from '../components/AppModal'

interface Invoice {
  id: string
  invoiceNumber: string
  issueDateTime: string
  totalAmount: number
  vatAmount: number
  status: string
  immutableFlag: boolean
  company: { name: string }
  customer: { name: string }
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/invoices')
      setInvoices(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/login')
      }
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (invoice: Invoice) => {
    setInvoiceToDelete(invoice)
  }

  const confirmDelete = async () => {
    if (!invoiceToDelete) return
    try {
      await api.delete(`/invoices/${invoiceToDelete.id}`)
      await fetchInvoices()
    } catch (error: any) {
      setModalError(error.response?.data?.message || 'Failed to delete invoice')
    } finally {
      setInvoiceToDelete(null)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (loading) {
    return <AppLoader />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard" className="flex items-center space-x-3">
                <div className="h-24 w-24 rounded-lg flex items-center justify-center">
                <Image src={zatcaLogo} alt="ZATCA logo" width={105} height={105} className="object-contain" />
                </div>
                <span className="text-sm text-gray-600 hover:text-gray-900">← Back to Dashboard</span>
              </Link>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600 mt-1">Manage your ZATCA compliant invoices</p>
          </div>
          <Link
            href="/invoices/new"
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            + Create New Invoice
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {invoice.company?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {invoice.customer?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(invoice.issueDateTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {Number(invoice.totalAmount ?? 0).toFixed(2)} SAR
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'issued'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(invoice)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && !loading && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new invoice.</p>
            </div>
          )}
        </div>
      </main>

      <AppModal
        isOpen={!!invoiceToDelete}
        title="Delete invoice?"
        message={
          invoiceToDelete
            ? `Delete invoice ${invoiceToDelete.invoiceNumber}? This cannot be undone.`
            : ''
        }
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={confirmDelete}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
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
