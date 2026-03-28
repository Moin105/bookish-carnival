'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '../lib/api'
import zatcaLogo from '../images/logo.png'
import AppLoader from '../components/AppLoader'
import AppModal from '../components/AppModal'

interface Customer {
  id: string
  name: string
  vatNumber: string
  type: 'B2B' | 'B2C'
  address: string
  city: string
  email: string
  phone: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const router = useRouter()

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers')
      setCustomers(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/login')
      }
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (customer: Customer) => {
    setCustomerToDelete(customer)
  }

  const confirmDelete = async () => {
    if (!customerToDelete) return
    try {
      await api.delete(`/customers/${customerToDelete.id}`)
      await fetchCustomers()
    } catch (error: any) {
      setModalError(error.response?.data?.message || 'Failed to remove customer')
    } finally {
      setCustomerToDelete(null)
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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/dashboard" className="flex items-center space-x-3">
                <div className="h-24 w-24 rounded-lg flex items-center justify-center">
                  <Image src={zatcaLogo} alt="ZATCA logo" width={105} height={105} className="object-contain" />
                </div>
              <span className="text-sm text-gray-600 hover:text-gray-900">← Back to Dashboard</span>
            </Link>
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
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage customer data for invoices</p>
          </div>
          <Link
            href="/customers/new"
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            + Add New Customer
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border border-gray-100"
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <h2 className="text-xl font-semibold">{customer.name}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      customer.type === 'B2B'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {customer.type}
                  </span>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(customer)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {customer.vatNumber && (
                <p className="text-gray-600 mb-1">VAT: {customer.vatNumber}</p>
              )}
              {customer.address && (
                <p className="text-gray-600 mb-1">{customer.address}</p>
              )}
              {customer.city && (
                <p className="text-gray-600 mb-1">{customer.city}</p>
              )}
              {customer.email && (
                <p className="text-gray-600 mb-1">{customer.email}</p>
              )}
              {customer.phone && (
                <p className="text-gray-600">{customer.phone}</p>
              )}
            </div>
          ))}
        </div>
        {customers.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first customer.</p>
          </div>
        )}
      </main>

      <AppModal
        isOpen={!!customerToDelete}
        title="Remove customer?"
        message={
          customerToDelete
            ? `Remove "${customerToDelete.name}" from the list?\nInvoices that use this customer are kept; you can add the customer again later.`
            : ''
        }
        onClose={() => setCustomerToDelete(null)}
        onConfirm={confirmDelete}
        confirmText="Remove"
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
