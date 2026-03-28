'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import api from '../lib/api'
import zatcaLogo from '../images/logo.png'
import AppLoader from '../components/AppLoader'
import AppModal from '../components/AppModal'

interface Company {
  id: string
  name: string
  vatNumber: string
  address: string
  city: string
  email: string
  phone: string
  isActive: boolean
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  const router = useRouter()

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies')
      setCompanies(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/login')
      }
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (company: Company) => {
    setCompanyToDelete(company)
  }

  const confirmDelete = async () => {
    if (!companyToDelete) return
    try {
      await api.delete(`/companies/${companyToDelete.id}`)
      await fetchCompanies()
    } catch (error: any) {
      setModalError(error.response?.data?.message || 'Failed to remove company')
    } finally {
      setCompanyToDelete(null)
    }
  }

  const handleToggleStatus = async (company: Company) => {
    setTogglingId(company.id)
    try {
      await api.patch(`/companies/${company.id}`, { isActive: !company.isActive })
      await fetchCompanies()
    } catch (error: any) {
      setModalError(error.response?.data?.message || 'Failed to update company status')
    } finally {
      setTogglingId(null)
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
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-1">Manage seller company information</p>
          </div>
          <Link
            href="/companies/new"
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            + Add New Company
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border border-gray-100"
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <h2 className="text-xl font-semibold">{company.name}</h2>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(company)}
                    disabled={togglingId === company.id}
                    className={`text-xs px-2 py-1 rounded-full font-medium border ${
                      company.isActive
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {togglingId === company.id
                      ? 'Updating...'
                      : company.isActive
                      ? 'Active'
                      : 'Inactive'}
                  </button>
                  <Link
                    href={`/companies/${company.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(company)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-gray-600 mb-1">VAT: {company.vatNumber}</p>
              {company.address && (
                <p className="text-gray-600 mb-1">{company.address}</p>
              )}
              {company.city && (
                <p className="text-gray-600 mb-1">{company.city}</p>
              )}
              {company.email && (
                <p className="text-gray-600 mb-1">{company.email}</p>
              )}
              {company.phone && (
                <p className="text-gray-600">{company.phone}</p>
              )}
            </div>
          ))}
        </div>
        {companies.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No companies</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your company information.</p>
          </div>
        )}
      </main>

      <AppModal
        isOpen={!!companyToDelete}
        title="Remove company?"
        message={
          companyToDelete
            ? `Remove "${companyToDelete.name}" from the list?\nInvoices that use it are kept; you can add the company again later.`
            : ''
        }
        onClose={() => setCompanyToDelete(null)}
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
