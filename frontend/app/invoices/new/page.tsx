'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '../../lib/api'

interface Company {
  id: string
  name: string
  vatNumber: string
  isActive?: boolean
}

interface Customer {
  id: string
  name: string
  email?: string
}

interface InvoiceItem {
  name: string
  description?: string
  quantity: number
  unitPrice: number
  vatRate?: number
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    companyId: '',
    customerId: '',
    issueDateTime: new Date().toISOString().split('T')[0],
    items: [
      {
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: 15,
      } as InvoiceItem,
    ],
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [companiesRes, customersRes] = await Promise.all([
        api.get('/companies'),
        api.get('/customers'),
      ])

      const activeCompanies = (companiesRes.data || []).filter(
        (company: Company) => company.isActive !== false
      )

      setCompanies(activeCompanies)
      setCustomers(customersRes.data)

      // Auto-select first company and customer if available
      if (activeCompanies.length > 0) {
        setFormData((prev) => ({
          ...prev,
          companyId: activeCompanies[0].id,
        }))
      }
      if (customersRes.data.length > 0) {
        setFormData((prev) => ({
          ...prev,
          customerId: customersRes.data[0].id,
        }))
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/login')
      } else {
        setError('Failed to load companies or customers')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          name: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          vatRate: 15,
        },
      ],
    })
  }

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index)
      setFormData({ ...formData, items: newItems })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Validation
    if (!formData.companyId) {
      setError('Please select a company')
      setSubmitting(false)
      return
    }

    if (!formData.customerId) {
      setError('Please select a customer')
      setSubmitting(false)
      return
    }

    if (formData.items.some((item) => !item.name || item.quantity <= 0 || item.unitPrice <= 0)) {
      setError('Please fill all item fields correctly')
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        companyId: formData.companyId,
        customerId: formData.customerId,
        issueDateTime: formData.issueDateTime || new Date().toISOString(),
        items: formData.items.map((item) => ({
          name: item.name,
          description: item.description || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          vatRate: item.vatRate || 15,
        })),
      }

      const response = await api.post('/invoices', payload)
      router.push(`/invoices/${response.data.id}`)
    } catch (error: any) {
      setError(
        error.response?.data?.message || 'Failed to create invoice. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/invoices" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Invoices</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Invoice</h1>
          <p className="text-gray-600">Create a ZATCA Phase 1 compliant invoice</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {companies.length === 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            No active companies found. Please create or activate a company first.
            <Link href="/companies" className="ml-2 underline">Create Company</Link>
          </div>
        )}

        {customers.length === 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            No customers found. Please create a customer first.
            <Link href="/customers" className="ml-2 underline">Create Customer</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          {/* Company and Customer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 mb-2">
                Company (Seller) <span className="text-red-500">*</span>
              </label>
              <select
                id="companyId"
                required
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.vatNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-2">
                Customer (Buyer) <span className="text-red-500">*</span>
              </label>
              <select
                id="customerId"
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.email && `(${customer.email})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="mb-8 max-w-md">
            <label htmlFor="issueDateTime" className="block text-sm font-medium text-gray-700 mb-2">
              Issue Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="issueDateTime"
              required
              value={formData.issueDateTime}
              onChange={(e) => setFormData({ ...formData, issueDateTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Invoice Items */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Invoice Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-gray-900">Item {index + 1}</h3>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter item name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Enter item description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Price (SAR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VAT Rate (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={item.vatRate || 15}
                        onChange={(e) => handleItemChange(index, 'vatRate', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/invoices"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || companies.length === 0 || customers.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
