import React, { useState, useEffect, useCallback } from 'react';
import { auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from './firebase.js';
import { collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import Logo from './logog.png'; // Make sure the filename matches exactly: logog.png

const appId = auth.app.options.projectId;

// Helper function for modals
const Modal = ({ message, onClose }) => {
    if (!message) return null; // Only render if there's a message
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p className="text-lg font-semibold mb-4">{message}</p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

// --- EXTRACTED COMPONENTS DEFINED HERE (OUTSIDE OF APP) ---

const AddPaymentExpenseForm = ({
    policies,
    paymentExpenseType, setPaymentExpenseType,
    paymentExpenseDate, setPaymentExpenseDate,
    paymentExpenseAmount, setPaymentExpenseAmount,
    paymentExpenseReason, setPaymentExpenseReason,
    selectedPolicyForPayment, setSelectedPolicyForPayment,
    handleAddPaymentExpense
}) => {
    return (
        <div className="p-5 bg-white rounded-xl shadow-sm space-y-4">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Add Payment / Add Expense</h2>
            <form onSubmit={handleAddPaymentExpense} className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-5">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Transaction Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="paymentExpenseType" className="block text-sm font-medium text-gray-700">Type <span className="text-red-500">*</span></label>
                            <select id="paymentExpenseType" value={paymentExpenseType} onChange={(e) => setPaymentExpenseType(e.target.value)}
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <option>Payment</option>
                                <option>Expense</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paymentExpenseDate" className="block text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
                            <input type="date" id="paymentExpenseDate" value={paymentExpenseDate} onChange={(e) => setPaymentExpenseDate(e.target.value)} required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="paymentExpenseAmount" className="block text-sm font-medium text-gray-700">Amount (BGN) <span className="text-red-500">*</span></label>
                            <input type="number" step="0.01" id="paymentExpenseAmount" placeholder="Amount" value={paymentExpenseAmount} onChange={(e) => setPaymentExpenseAmount(e.target.value)} required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="paymentExpenseReason" className="block text-sm font-medium text-gray-700">Reason</label>
                            <textarea id="paymentExpenseReason" placeholder="Reason (e.g., policy renewal, office supplies)" rows="3" value={paymentExpenseReason} onChange={(e) => setPaymentExpenseReason(e.target.value)}
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="selectedPolicyForPayment" className="block text-sm font-medium text-gray-700">Link to Policy (Optional):</label>
                            <select id="selectedPolicyForPayment" value={selectedPolicyForPayment} onChange={(e) => setSelectedPolicyForPayment(e.target.value)}
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <option value="">-- No Policy --</option>
                                {policies.map(policy => (
                                    <option key={policy.id} value={policy.id}>
                                        {policy.policyNumber} - {policy.customer?.firstName} {policy.customer?.lastName} ({policy.policyType})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition duration-200">
                    Add {paymentExpenseType}
                </button>
            </form>
        </div>
    );
};

const Dashboard = ({ policies, loadingPolicies }) => {
    const totalPolicies = policies.length;
    const totalPolicyValue = policies.reduce((acc, policy) => acc + (parseFloat(policy.totalAmount) || 0), 0);
    const totalCommission = policies.reduce((acc, policy) => acc + (parseFloat(policy.commission) || 0), 0);
    const policiesPaidByCustomer = policies.filter(policy => policy.paidByCustomer).length;
    const policiesPaidToInsurer = policies.filter(policy => policy.paidToInsurer).length;
    const overduePolicies = policies.filter(policy => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validUntilDate = policy.validUntil ? new Date(policy.validUntil) : null;
        return validUntilDate && validUntilDate < today;
    }).length;

    return (
        <div className="p-5 bg-white rounded-xl shadow-sm space-y-6">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Dashboard Overview</h2>
            {loadingPolicies ? (
                <div className="flex justify-center items-center h-48 text-blue-600 text-xl font-semibold">
                    <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading dashboard data...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Policies</h3>
                        <p className="text-4xl font-bold text-gray-900">{totalPolicies}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Policy Value</h3>
                        <p className="text-4xl font-bold text-gray-900">BGN {totalPolicyValue.toFixed(2)}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Commission (Profit)</h3>
                        <p className="text-4xl font-bold text-gray-900">BGN {totalCommission.toFixed(2)}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Overdue Policies</h3>
                        <p className="text-4xl font-bold text-gray-900">{overduePolicies}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Paid by Customer</h3>
                        <p className="text-4xl font-bold text-gray-900">{policiesPaidByCustomer}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Paid to Insurer</h3>
                        <p className="text-4xl font-bold text-gray-900">{policiesPaidToInsurer}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const FinancialReports = ({ policies, paymentsExpenses, loadingPolicies, loadingPaymentsExpenses, formatDate }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filteredPoliciesReport, setFilteredPoliciesReport] = useState([]);
    const [filteredPaymentsExpenses, setFilteredPaymentsExpenses] = useState([]);


    useEffect(() => {
        let tempPolicies = [...policies];
        let tempPaymentsExpenses = [...paymentsExpenses];

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            tempPolicies = tempPolicies.filter(policy => {
                const policyCreatedAt = policy.createdAt?.toDate();
                return policyCreatedAt && policyCreatedAt >= start && policyCreatedAt <= end;
            });
            tempPaymentsExpenses = tempPaymentsExpenses.filter(item => {
                const itemDate = item.createdAt?.toDate() || new Date(item.date); // Use createdAt or item.date for filtering
                return itemDate && itemDate >= start && itemDate <= end;
            });
        }
        setFilteredPoliciesReport(tempPolicies);
        setFilteredPaymentsExpenses(tempPaymentsExpenses);
    }, [startDate, endDate, policies, paymentsExpenses]);

    const totalIncome = filteredPoliciesReport.reduce((acc, policy) => acc + (parseFloat(policy.totalAmount) || 0), 0);
    const totalCommission = filteredPoliciesReport.reduce((acc, policy) => acc + (parseFloat(policy.commission) || 0), 0);
    const totalExpenses = filteredPaymentsExpenses.filter(item => item.type === 'Expense').reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

    const commissionNotPaidToInsurer = filteredPoliciesReport.reduce((acc, policy) =>
        acc + (policy.paidToInsurer ? 0 : (parseFloat(policy.commission) || 0)), 0
    );
    const totalUnpaidToInsurer = filteredPoliciesReport.reduce((acc, policy) => acc + (policy.paidToInsurer ? 0 : (parseFloat(policy.totalAmount) || 0)), 0);
    const amountDueToInsurer = totalUnpaidToInsurer - commissionNotPaidToInsurer;

    return (
        <div className="p-5 bg-white rounded-xl shadow-sm space-y-6">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Financial Reports</h2>
            <div className="mb-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">From Date:</label>
                    <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">To Date:</label>
                    <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
            </div>

            {loadingPolicies || loadingPaymentsExpenses ? (
                <div className="flex justify-center items-center h-48 text-blue-600 text-xl font-semibold">
                    <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading financial data...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Income */}
                    <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-lg text-gray-700 mb-1">Total Income</h3>
                        <p className="text-3xl font-bold text-gray-900">BGN {totalIncome.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">From {filteredPoliciesReport.length} policies</p>
                    </div>
                    {/* Total Commission */}
                    <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-lg text-gray-700 mb-1">Total Commission</h3>
                        <p className="text-3xl font-bold text-gray-900">BGN {totalCommission.toFixed(2)}</p>
                    </div>
                    {/* Total Expenses */}
                    <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-lg text-gray-700 mb-1">Total Expenses</h3>
                        <p className="text-3xl font-bold text-gray-900">BGN {totalExpenses.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">From {filteredPaymentsExpenses.filter(item => item.type === 'Expense').length} expenses</p>
                    </div>
                    {/* Amount Due to Insurer */}
                    <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-lg text-gray-700 mb-1">Amount Due to Insurer</h3>
                        <p className="text-3xl font-bold text-gray-900">BGN {amountDueToInsurer.toFixed(2)}</p>
                        <p className="text-sm text-gray-600"> (Unpaid to insurer - Commission)</p>
                    </div>
                </div>
            )}

            <div className="mt-8">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Detailed Breakdown</h3>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-600">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Filtered Policies</h4>
                    {filteredPoliciesReport.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Policy #</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredPoliciesReport.map(policy => (
                                        <tr key={policy.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{policy.policyNumber}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{policy.customer?.firstName} {policy.customer?.lastName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">BGN {policy.totalAmount?.toFixed(2)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">BGN {policy.commission?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No policies in this date range.</p>
                    )}

                    <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Filtered Payments & Expenses</h4>
                    {filteredPaymentsExpenses.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Linked Policy</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredPaymentsExpenses
                                        .filter(item => item.policyId === item.policyId) // This filter seems redundant, but kept from original
                                        .sort((a, b) => (b.createdAt?.toDate() || new Date(b.date)).getTime() - (a.createdAt?.toDate() || new Date(a.date)).getTime())
                                        .map(item => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">{item.type}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDate(item.date)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">BGN {item.amount?.toFixed(2)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">{item.reason || 'N/A'}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">
                                                    {item.policyId ? (
                                                        policies.find(p => p.id === item.policyId)?.policyNumber || 'N/A'
                                                    ) : 'None'}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No payments or expenses in this date range.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const ViewPolicies = ({
    policies,
    paymentsExpenses,
    loadingPolicies,
    loadingPaymentsExpenses,
    filterPolicyType, setFilterPolicyType,
    filterCustomerName, setFilterCustomerName,
    filterPolicyNumber, setFilterPolicyNumber,
    filterPaidByCustomer, setFilterPaidByCustomer,
    filterPaidToInsurer, setFilterPaidToInsurer,
    filterValidUntilStartDate, setFilterValidUntilStartDate,
    filterValidUntilEndDate, setFilterValidUntilEndDate,
    sortColumn, setSortColumn,
    sortDirection, setSortDirection,
    expandedPolicyId, setExpandedPolicyId, // Removed isPolicyEditModalOpen and selectedPolicyForEdit here
    handleDeletePolicy,
    handleEditPolicyClick, // This is now a prop from App
    handleDeletePaymentExpense, // This is now a prop from App
    formatDate, // This is now a prop from App
    userId // userId for display if needed
}) => {
    const filteredAndSortedPolicies = policies
        .filter(policy => {
            const matchesPolicyType = filterPolicyType === '' || policy.policyType.toLowerCase().includes(filterPolicyType.toLowerCase());
            const matchesCustomerName = filterCustomerName === '' ||
                (policy.customer?.firstName?.toLowerCase().includes(filterCustomerName.toLowerCase()) ||
                    policy.customer?.lastName?.toLowerCase().includes(filterCustomerName.toLowerCase()));
            const matchesPolicyNumber = filterPolicyNumber === '' || policy.policyNumber.toLowerCase().includes(filterPolicyNumber.toLowerCase());
            const matchesPaidByCustomer = filterPaidByCustomer === 'all' || policy.paidByCustomer === (filterPaidByCustomer === 'yes');
            const matchesPaidToInsurer = filterPaidToInsurer === 'all' || policy.paidToInsurer === (filterPaidToInsurer === 'yes');

            let matchesValidUntilDate = true;
            if (filterValidUntilStartDate && policy.validUntil) {
                const start = new Date(filterValidUntilStartDate);
                start.setHours(0, 0, 0, 0);
                const policyValidUntil = new Date(policy.validUntil);
                matchesValidUntilDate = matchesValidUntilDate && policyValidUntil >= start;
            }
            if (filterValidUntilEndDate && policy.validUntil) {
                const end = new Date(filterValidUntilEndDate);
                end.setHours(23, 59, 59, 999);
                const policyValidUntil = new Date(policy.validUntil);
                matchesValidUntilDate = matchesValidUntilDate && policyValidUntil <= end;
            }

            return matchesPolicyType && matchesCustomerName && matchesPolicyNumber && matchesPaidByCustomer && matchesPaidToInsurer && matchesValidUntilDate;
        })
        .sort((a, b) => {
            let valA, valB;
            if (sortColumn === 'customer') {
                valA = `${a.customer?.firstName || ''} ${a.customer?.lastName || ''}`.toLowerCase();
                valB = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.toLowerCase();
            } else if (sortColumn === 'createdAt' || sortColumn === 'policyDate' || sortColumn === 'validUntil') {
                valA = a[sortColumn] ? new Date(a[sortColumn]).getTime() : 0;
                valB = b[sortColumn] ? new Date(b[sortColumn]).getTime() : 0;
            }
            else {
                valA = typeof a[sortColumn] === 'string' ? a[sortColumn].toLowerCase() : a[sortColumn];
                valB = typeof b[sortColumn] === 'string' ? b[sortColumn].toLowerCase() : b[sortColumn];
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc'); // Default to ascending when changing column
        }
    };

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
    };

    // Function to toggle expanded policy row
    const toggleExpandedPolicy = (policyId) => {
        setExpandedPolicyId(prevId => (prevId === policyId ? null : policyId));
    };


    return (
        <div className="p-5 bg-white rounded-xl shadow-sm">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">View Insurance Policies</h2>
            {userId && (
                <p className="text-sm text-gray-500 text-center mb-4">
                    User ID: <span className="font-mono bg-gray-100 p-1 rounded text-gray-700">{userId}</span>
                </p>
            )}

            {/* Filters */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="filterPolicyType" className="block text-sm font-medium text-gray-700">Policy Type:</label>
                    <input type="text" id="filterPolicyType" value={filterPolicyType} onChange={(e) => setFilterPolicyType(e.target.value)}
                        placeholder="Filter by type..." className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label htmlFor="filterCustomerName" className="block text-sm font-medium text-gray-700">Customer Name:</label>
                    <input type="text" id="filterCustomerName" value={filterCustomerName} onChange={(e) => setFilterCustomerName(e.target.value)}
                        placeholder="Filter by customer..." className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label htmlFor="filterPolicyNumber" className="block text-sm font-medium text-gray-700">Policy Number:</label>
                    <input type="text" id="filterPolicyNumber" value={filterPolicyNumber} onChange={(e) => setFilterPolicyNumber(e.target.value)}
                        placeholder="Filter by policy #..." className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label htmlFor="filterPaidByCustomer" className="block text-sm font-medium text-gray-700">Paid by Customer:</label>
                    <select id="filterPaidByCustomer" value={filterPaidByCustomer} onChange={(e) => setFilterPaidByCustomer(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="all">All</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="filterPaidToInsurer" className="block text-sm font-medium text-gray-700">Paid to Insurer:</label>
                    <select id="filterPaidToInsurer" value={filterPaidToInsurer} onChange={(e) => setFilterPaidToInsurer(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="all">All</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
                </div>
                {/* NEW: Valid Until date filters */}
                <div>
                    <label htmlFor="filterValidUntilStartDate" className="block text-sm font-medium text-gray-700">Valid Until From:</label>
                    <input type="date" id="filterValidUntilStartDate" value={filterValidUntilStartDate} onChange={(e) => setFilterValidUntilStartDate(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label htmlFor="filterValidUntilEndDate" className="block text-sm font-medium text-gray-700">Valid Until To:</label>
                    <input type="date" id="filterValidUntilEndDate" value={filterValidUntilEndDate} onChange={(e) => setFilterValidUntilEndDate(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                </div>
            </div>

            {loadingPolicies || loadingPaymentsExpenses ? (
                <div className="flex justify-center items-center h-48 text-indigo-600 text-xl font-semibold">
                    <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading policies and payments/expenses...
                </div>
            ) : filteredAndSortedPolicies.length === 0 ? (
                <div className="text-center text-gray-600 text-lg">No policies found matching your criteria.</div>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>{/* For expand button */}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('policyNumber')}>
                                    Policy #{getSortIndicator('policyNumber')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customer')}>
                                    Customer{getSortIndicator('customer')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('policyType')}>
                                    Type{getSortIndicator('policyType')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalAmount')}>
                                    Amount{getSortIndicator('totalAmount')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('policyDate')}>
                                    Date{getSortIndicator('policyDate')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('validUntil')}>
                                    Valid Until{getSortIndicator('validUntil')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid by Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid to Insurer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedPolicies.map((policy) => (
                                <React.Fragment key={policy.id}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-2 py-4 text-center">
                                            <button onClick={() => toggleExpandedPolicy(policy.id)} className="text-gray-500 hover:text-gray-800 focus:outline-none">
                                                {expandedPolicyId === policy.id ? '▼' : '►'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{policy.policyNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{policy.customer?.firstName} {policy.customer?.lastName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{policy.policyType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">BGN {policy.totalAmount?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(policy.policyDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(policy.validUntil)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {policy.paidByCustomer ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Yes</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {policy.paidToInsurer ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Yes</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEditPolicyClick(policy)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 transition mr-2">Edit</button>
                                            <button onClick={() => handleDeletePolicy(policy.id, policy.policyNumber)} className="text-red-600 hover:text-red-900 p-1 rounded-md bg-red-50 hover:bg-red-100 transition">Delete</button>
                                        </td>
                                    </tr>
                                    {/* Expanded row for payments/expenses */}
                                    {expandedPolicyId === policy.id && (
                                        <tr>
                                            <td colSpan="11" className="p-4 bg-gray-50 border-t border-gray-200">
                                                <div className="ml-8">
                                                    <h4 className="text-md font-semibold text-gray-800 mb-2">Payments/Expenses for Policy {policy.policyNumber}</h4>
                                                    {loadingPaymentsExpenses ? (
                                                        <div className="text-gray-600 text-sm">Loading linked payments/expenses...</div>
                                                    ) : (
                                                        paymentsExpenses.filter(item => item.policyId === policy.id).length > 0 ? (
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full divide-y divide-gray-200">
                                                                    <thead className="bg-gray-100">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                                        {paymentsExpenses
                                                                            .filter(item => item.policyId === policy.id)
                                                                            .sort((a, b) => (b.createdAt?.toDate() || new Date(b.date)).getTime() - (a.createdAt?.toDate() || new Date(a.date)).getTime())
                                                                            .map(item => (
                                                                                <tr key={item.id}>
                                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{item.type}</td>
                                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDate(item.date)}</td>
                                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">BGN {item.amount?.toFixed(2)}</td>
                                                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{item.reason || 'N/A'}</td>
                                                                                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                                                                                        <button onClick={() => handleDeletePaymentExpense(item.id, item.type, item.amount)} className="text-red-600 hover:text-red-900 p-1 rounded-md bg-red-50 hover:bg-red-100 transition">Delete</button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-600">No linked payments or expenses for this policy.</p>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const EditPolicyModal = ({ policy, onClose, onSave, formatDate }) => {
    const [editPolicyData, setEditPolicyData] = useState(policy);

    useEffect(() => {
        // Ensure that date fields are formatted correctly when the policy prop changes
        setEditPolicyData({
            ...policy,
            policyDate: formatDate(policy.policyDate),
            validUntil: formatDate(policy.validUntil)
        });
    }, [policy, formatDate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('customer.')) {
            const customerField = name.split('.')[1];
            setEditPolicyData(prev => ({
                ...prev,
                customer: {
                    ...prev.customer,
                    [customerField]: value
                }
            }));
        } else {
            setEditPolicyData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(editPolicyData);
    };

    if (!policy) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-2xl w-full relative overflow-y-auto max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Edit Policy</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Policy Details */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Policy Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editPolicyType" className="block text-sm font-medium text-gray-700">Policy Type</label>
                                <select id="editPolicyType" name="policyType" value={editPolicyData.policyType} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <option>New Policy</option>
                                    <option>Policy Payment</option>
                                    <option>Toll</option>
                                    <option>Assessment</option>
                                    <option>Sticker</option>
                                    <option>Certificate</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="editPolicyNumber" className="block text-sm font-medium text-gray-700">Policy Number</label>
                                <input type="text" id="editPolicyNumber" name="policyNumber" value={editPolicyData.policyNumber} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editPolicyDate" className="block text-sm font-medium text-gray-700">Policy Date</label>
                                <input type="date" id="editPolicyDate" name="policyDate" value={editPolicyData.policyDate} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editValidUntil" className="block text-sm font-medium text-gray-700">Valid Until</label>
                                <input type="date" id="editValidUntil" name="validUntil" value={editPolicyData.validUntil} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editTotalAmount" className="block text-sm font-medium text-gray-700">Total Amount (BGN)</label>
                                <input type="number" step="0.01" id="editTotalAmount" name="totalAmount" value={editPolicyData.totalAmount} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editCommission" className="block text-sm font-medium text-gray-700">Commission (BGN)</label>
                                <input type="number" step="0.01" id="editCommission" name="commission" value={editPolicyData.commission} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editVehicleNumber" className="block text-sm font-medium text-gray-700">Vehicle Number</label>
                                <input type="text" id="editVehicleNumber" name="vehicleNumber" value={editPolicyData.vehicleNumber} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editInsuranceType" className="block text-sm font-medium text-gray-700">Insurance Type</label>
                                <input type="text" id="editInsuranceType" name="insuranceType" value={editPolicyData.insuranceType} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="editPaidByCustomer" name="paidByCustomer" checked={editPolicyData.paidByCustomer} onChange={handleChange}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <label htmlFor="editPaidByCustomer" className="text-sm font-medium text-gray-700">Paid by Customer</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="editPaidToInsurer" name="paidToInsurer" checked={editPolicyData.paidToInsurer} onChange={handleChange}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <label htmlFor="editPaidToInsurer" className="text-sm font-medium text-gray-700">Paid to Insurer</label>
                            </div>
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Customer Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-700">First Name</label>
                                <input type="text" id="editFirstName" name="customer.firstName" value={editPolicyData.customer?.firstName || ''} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editLastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                                <input type="text" id="editLastName" name="customer.lastName" value={editPolicyData.customer?.lastName || ''} onChange={handleChange} required
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editPhoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                                <input type="text" id="editPhoneNumber" name="customer.phoneNumber" value={editPolicyData.customer?.phoneNumber || ''} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editIdNumber" className="block text-sm font-medium text-gray-700">ID Number</label>
                                <input type="text" id="editIdNumber" name="customer.idNumber" value={editPolicyData.customer?.idNumber || ''} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="editAddress" className="block text-sm font-medium text-gray-700">Address</label>
                                <input type="text" id="editAddress" name="customer.address" value={editPolicyData.customer?.address || ''} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editCity" className="block text-sm font-medium text-gray-700">City</label>
                                <input type="text" id="editCity" name="customer.city" value={editPolicyData.customer?.city || ''} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="editPostalCode" className="block text-sm font-medium text-gray-700">Postal Code</label>
                                <input type="text" id="editPostalCode" name="customer.postalCode" value={editPolicyData.customer?.postalCode || ''} onChange={handleChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose}
                            className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition duration-200">
                            Cancel
                        </button>
                        <button type="submit"
                            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditCustomerModal = ({ customer, onClose, onSave }) => {
    const [editCustomerData, setEditCustomerData] = useState(customer);

    useEffect(() => {
        // Initialize editCustomerData when the customer prop changes
        setEditCustomerData(customer);
    }, [customer]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditCustomerData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(editCustomerData);
    };

    if (!customer) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Edit Customer Details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="editCustomerFirstName" className="block text-sm font-medium text-gray-700">First Name</label>
                        <input type="text" id="editCustomerFirstName" name="firstName" value={editCustomerData.firstName || ''} onChange={handleChange} required
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerLastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input type="text" id="editCustomerLastName" name="lastName" value={editCustomerData.lastName || ''} onChange={handleChange} required
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerPhoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input type="text" id="editCustomerPhoneNumber" name="phoneNumber" value={editCustomerData.phoneNumber || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerIdNumber" className="block text-sm font-medium text-gray-700">ID Number (Cannot be changed)</label>
                        <input type="text" id="editCustomerIdNumber" name="idNumber" value={editCustomerData.idNumber || ''} disabled
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 cursor-not-allowed" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerAddress" className="block text-sm font-medium text-gray-700">Address</label>
                        <input type="text" id="editCustomerAddress" name="address" value={editCustomerData.address || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerCity" className="block text-sm font-medium text-gray-700">City</label>
                        <input type="text" id="editCustomerCity" name="city" value={editCustomerData.city || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="editCustomerPostalCode" className="block text-sm font-medium text-gray-700">Postal Code</label>
                        <input type="text" id="editCustomerPostalCode" name="postalCode" value={editCustomerData.postalCode || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose}
                            className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition duration-200">
                            Cancel
                        </button>
                        <button type="submit"
                            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CustomerManagement = ({ policies, loadingPolicies, handleUpdateCustomer, setIsCustomerEditModalOpen, setSelectedCustomerForEdit }) => {
    const uniqueCustomers = policies.reduce((acc, policy) => {
        if (policy.customer && policy.customer.idNumber) {
            if (!acc[policy.customer.idNumber]) {
                acc[policy.customer.idNumber] = {
                    idNumber: policy.customer.idNumber,
                    firstName: policy.customer.firstName,
                    lastName: policy.customer.lastName,
                    phoneNumber: policy.customer.phoneNumber,
                    address: policy.customer.address,
                    city: policy.customer.city,
                    postalCode: policy.customer.postalCode,
                    policiesCount: 0,
                    totalPolicyValue: 0,
                    associatedPolicies: []
                };
            }
            acc[policy.customer.idNumber].policiesCount++;
            acc[policy.customer.idNumber].totalPolicyValue += (parseFloat(policy.totalAmount) || 0);
            acc[policy.customer.idNumber].associatedPolicies.push({
                id: policy.id,
                policyNumber: policy.policyNumber,
                policyType: policy.policyType,
                totalAmount: policy.totalAmount,
                policyDate: policy.policyDate
            });
        }
        return acc;
    }, {});

    const customersList = Object.values(uniqueCustomers);

    const handleEditCustomerClick = (customer) => {
        setSelectedCustomerForEdit(customer);
        setIsCustomerEditModalOpen(true);
    };

    return (
        <div className="p-5 bg-white rounded-xl shadow-sm space-y-6">
            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Customer Management</h2>
            {loadingPolicies ? (
                <div className="flex justify-center items-center h-48 text-blue-600 text-xl font-semibold">
                    <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading customer data...
                </div>
            ) : customersList.length === 0 ? (
                <div className="text-center text-gray-600 text-lg">No customers found. Add policies to populate customer data.</div>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Policies</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Policy Value</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {customersList.map((customer, index) => (
                                <tr key={customer.idNumber || index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.firstName} {customer.lastName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{customer.phoneNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{customer.idNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{customer.city}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{customer.policiesCount}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">BGN {customer.totalPolicyValue.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEditCustomerClick(customer)}
                                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md bg-blue-50 hover:bg-blue-100 transition"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* The modal (EditCustomerModal) is rendered in App component, and its state is managed by App */}
        </div>
    );
};


// --- MAIN APP COMPONENT ---
const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Auth Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [authMessage, setAuthMessage] = useState('');

    // General Modal State (for all general notifications)
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    // Policy & Customer Data States
    const [policies, setPolicies] = useState([]);
    const [loadingPolicies, setLoadingPolicies] = useState(true);
    // State for payments and expenses
    const [paymentsExpenses, setPaymentsExpenses] = useState([]);
    const [loadingPaymentsExpenses, setLoadingPaymentsExpenses] = useState(true);

    // Policy Filters and Sort States
    const [filterPolicyType, setFilterPolicyType] = useState('');
    const [filterCustomerName, setFilterCustomerName] = useState('');
    const [filterPolicyNumber, setFilterPolicyNumber] = useState('');
    const [filterPaidByCustomer, setFilterPaidByCustomer] = useState('all');
    const [filterPaidToInsurer, setFilterPaidToInsurer] = useState('all');
    const [filterValidUntilStartDate, setFilterValidUntilStartDate] = useState('');
    const [filterValidUntilEndDate, setFilterValidUntilEndDate] = useState('');


    const [sortColumn, setSortColumn] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');

    // Edit Modals State
    const [isPolicyEditModalOpen, setIsPolicyEditModalOpen] = useState(false);
    const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState(null);
    const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
    const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState(null);

    // States for the Add Policy form
    const [policyType, setPolicyType] = useState('New Policy');
    const [policyDate, setPolicyDate] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [commission, setCommission] = useState('');
    const [policyNumber, setPolicyNumber] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [insuranceType, setInsuranceType] = useState('');
    const [paidByCustomer, setPaidByCustomer] = useState(false);
    const [paidToInsurer, setPaidToInsurer] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');

    // States for Add Payment/Expense form
    const [paymentExpenseType, setPaymentExpenseType] = useState('Payment');
    const [paymentExpenseDate, setPaymentExpenseDate] = useState('');
    const [paymentExpenseAmount, setPaymentExpenseAmount] = useState('');
    const [paymentExpenseReason, setPaymentExpenseReason] = useState('');
    const [selectedPolicyForPayment, setSelectedPolicyForPayment] = useState(''); // Stores policy.id

    // State to manage expanded policy rows in View Policies
    const [expandedPolicyId, setExpandedPolicyId] = useState(null);

    // Firebase Authentication Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setUserId(currentUser ? currentUser.uid : null);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // Fetch policies from Firestore (only if user is logged in)
    useEffect(() => {
        if (!db || !userId) {
            setPolicies([]);
            setLoadingPolicies(false);
            return;
        }

        setLoadingPolicies(true);
        const projectId = auth.app.options.projectId;
        const policiesCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/policies`);
        const q = query(policiesCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPolicies = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            fetchedPolicies.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            setPolicies(fetchedPolicies);
            setLoadingPolicies(false);
        }, (error) => {
            console.error("Error fetching policies:", error);
            setLoadingPolicies(false);
            setModalMessage(`Error fetching policies: ${error.message}`);
            setShowModal(true);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Fetch payments/expenses from Firestore
    useEffect(() => {
        if (!db || !userId) {
            setPaymentsExpenses([]);
            setLoadingPaymentsExpenses(false);
            return;
        }

        setLoadingPaymentsExpenses(true);
        const projectId = auth.app.options.projectId;
        const paymentsExpensesCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/payments_expenses`);
        const q = query(paymentsExpensesCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPaymentsExpenses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPaymentsExpenses(fetchedPaymentsExpenses);
            setLoadingPaymentsExpenses(false);
        }, (error) => {
            console.error("Error fetching payments/expenses:", error);
            setLoadingPaymentsExpenses(false);
            setModalMessage(`Error fetching payments/expenses: ${error.message}`);
            setShowModal(true);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);


    // Handle Login/Register
    const handleAuth = async (e) => {
        e.preventDefault();
        setAuthMessage('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                setAuthMessage('Logged in successfully!');
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                setAuthMessage('Registered and logged in successfully!');
            }
        } catch (error) {
            console.error("Auth error:", error);
            setAuthMessage(`Error: ${error.message}`);
        }
    };

    // Handle Logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setAuthMessage('Logged out successfully!');
            setPolicies([]);
            setPaymentsExpenses([]); // Clear payments/expenses on logout
            setCurrentPage('dashboard');
        } catch (error) {
            console.error("Logout error:", error);
            setAuthMessage(`Error logging out: ${error.message}`);
        }
    };

    // Handle form submission for Add Policy
    const handleAddPolicy = async (e) => {
        e.preventDefault();
        setAuthMessage('');
        let formMsg = '';

        if (!db || !userId) {
            formMsg = 'Error: Database not ready or user not authenticated. Please log in.';
            setModalMessage(formMsg);
            setShowModal(true);
            return;
        }

        if (!policyNumber || !totalAmount || !policyDate || !validUntil || !firstName || !lastName) {
            formMsg = 'Please fill in all required fields: Policy Number, Total Amount, Policy Date, Valid Until, Customer First Name, Customer Last Name.';
            setModalMessage(formMsg);
            setShowModal(true);
            return;
        }

        try {
            const projectId = auth.app.options.projectId;
            await addDoc(collection(db, `artifacts/${projectId}/users/${userId}/policies`), {
                policyType,
                policyDate,
                validUntil,
                totalAmount: parseFloat(totalAmount),
                commission: parseFloat(commission) || 0,
                policyNumber,
                vehicleNumber,
                insuranceType,
                paidByCustomer,
                paidToInsurer,
                customer: {
                    firstName,
                    lastName,
                    phoneNumber,
                    idNumber,
                    address,
                    city,
                    postalCode,
                },
                createdAt: serverTimestamp(),
            });
            setModalMessage('Policy added successfully!');
            setShowModal(true);
            // Clear form fields
            setPolicyType('New Policy'); setPolicyDate(''); setValidUntil(''); setTotalAmount('');
            setCommission(''); setPolicyNumber(''); setVehicleNumber(''); setInsuranceType('');
            setPaidByCustomer(false); setPaidToInsurer(false); setFirstName(''); setLastName('');
            setPhoneNumber(''); setIdNumber(''); setAddress(''); setCity(''); setPostalCode('');
        } catch (error) {
            console.error("Error adding document: ", error);
            setModalMessage(`Error adding policy: ${error.message}`);
            setShowModal(true);
        }
    };

    // Handle policy update (for Edit Policy Modal)
    const handleUpdatePolicy = async (updatedPolicy) => {
        if (!db || !userId || !updatedPolicy.id) {
            setModalMessage('Error: Database not ready or policy ID missing.');
            setShowModal(true);
            return;
        }
        try {
            const projectId = auth.app.options.projectId;
            const policyRef = doc(db, `artifacts/${projectId}/users/${userId}/policies`, updatedPolicy.id);
            await updateDoc(policyRef, {
                policyType: updatedPolicy.policyType,
                policyDate: updatedPolicy.policyDate,
                validUntil: updatedPolicy.validUntil,
                totalAmount: parseFloat(updatedPolicy.totalAmount),
                commission: parseFloat(updatedPolicy.commission) || 0,
                policyNumber: updatedPolicy.policyNumber,
                vehicleNumber: updatedPolicy.vehicleNumber,
                insuranceType: updatedPolicy.insuranceType,
                paidByCustomer: updatedPolicy.paidByCustomer,
                paidToInsurer: updatedPolicy.paidToInsurer,
                customer: {
                    firstName: updatedPolicy.customer.firstName,
                    lastName: updatedPolicy.customer.lastName,
                    phoneNumber: updatedPolicy.customer.phoneNumber,
                    idNumber: updatedPolicy.customer.idNumber,
                    address: updatedPolicy.customer.address,
                    city: updatedPolicy.customer.city,
                    postalCode: updatedPolicy.customer.postalCode,
                },
            });
            setModalMessage('Policy updated successfully!');
            setShowModal(true);
            setIsPolicyEditModalOpen(false);
            setSelectedPolicyForEdit(null);
        } catch (error) {
            console.error("Error updating policy: ", error);
            setModalMessage(`Error updating policy: ${error.message}`);
            setShowModal(true);
        }
    };

    // Handle customer update (for Edit Customer Modal)
    const handleUpdateCustomer = async (updatedCustomer) => {
        if (!db || !userId || !updatedCustomer.idNumber) {
            setModalMessage('Error: Database not ready or customer ID Number missing.');
            setShowModal(true);
            return;
        }
        try {
            const projectId = auth.app.options.projectId;
            const batchUpdates = policies.map(policy => {
                if (policy.customer && policy.customer.idNumber === updatedCustomer.idNumber) {
                    const policyRef = doc(db, `artifacts/${projectId}/users/${userId}/policies`, policy.id);
                    return updateDoc(policyRef, {
                        'customer.firstName': updatedCustomer.firstName,
                        'customer.lastName': updatedCustomer.lastName,
                        'customer.phoneNumber': updatedCustomer.phoneNumber,
                        'customer.address': updatedCustomer.address,
                        'customer.city': updatedCustomer.city,
                        'customer.postalCode': updatedCustomer.postalCode,
                    });
                }
                return Promise.resolve();
            }).filter(Boolean);

            await Promise.all(batchUpdates);

            setModalMessage('Customer details updated successfully across all associated policies!');
            setShowModal(true);
            setIsCustomerEditModalOpen(false);
            setSelectedCustomerForEdit(null);
        } catch (error) {
            console.error("Error updating customer details: ", error);
            setModalMessage(`Error updating customer: ${error.message}`);
            setShowModal(true);
        }
    };

    // Handle adding payment/expense
    const handleAddPaymentExpense = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            setModalMessage('Error: Database not ready or user not authenticated. Please log in.');
            setShowModal(true);
            return;
        }

        if (!paymentExpenseDate || !paymentExpenseAmount || !paymentExpenseType) {
            setModalMessage('Please fill in Date, Amount, and Type for the payment/expense.');
            setShowModal(true);
            return;
        }

        try {
            const projectId = auth.app.options.projectId;
            await addDoc(collection(db, `artifacts/${projectId}/users/${userId}/payments_expenses`), {
                type: paymentExpenseType,
                date: paymentExpenseDate,
                amount: parseFloat(paymentExpenseAmount),
                reason: paymentExpenseReason,
                policyId: selectedPolicyForPayment || null, // Link to policy if selected
                createdAt: serverTimestamp(),
            });
            setModalMessage(`${paymentExpenseType} added successfully!`);
            setShowModal(true);
            // Clear form fields
            setPaymentExpenseType('Payment');
            setPaymentExpenseDate('');
            setPaymentExpenseAmount('');
            setPaymentExpenseReason('');
            setSelectedPolicyForPayment('');
        } catch (error) {
            console.error("Error adding payment/expense: ", error);
            setModalMessage(`Error adding ${paymentExpenseType}: ${error.message}`);
            setShowModal(true);
        }
    };

    // Handle deleting a policy
    const handleDeletePolicy = async (policyId, policyNumber) => {
        if (!db || !userId) {
            setModalMessage('Error: Database not ready or user not authenticated.');
            setShowModal(true);
            return;
        }
        if (window.confirm(`Are you sure you want to delete policy number: ${policyNumber}? This will also delete all associated payments/expenses. This action cannot be undone.`)) {
            try {
                const projectId = auth.app.options.projectId;
                const policyRef = doc(db, `artifacts/${projectId}/users/${userId}/policies`, policyId);
                await deleteDoc(policyRef);

                // Also delete any associated payments/expenses
                const relatedPaymentsExpenses = paymentsExpenses.filter(item => item.policyId === policyId);
                const deletePromises = relatedPaymentsExpenses.map(item => {
                    const itemRef = doc(db, `artifacts/${projectId}/users/${userId}/payments_expenses`, item.id);
                    return deleteDoc(itemRef);
                });
                await Promise.all(deletePromises);

                setModalMessage('Policy and associated items deleted successfully!');
                setShowModal(true);
            } catch (error) {
                console.error("Error deleting policy: ", error);
                setModalMessage(`Error deleting policy: ${error.message}`);
                setShowModal(true);
            }
        }
    };

    // Handle deleting a payment/expense
    const handleDeletePaymentExpense = async (itemId, itemType, itemAmount) => {
        if (!db || !userId) {
            setModalMessage('Error: Database not ready or user not authenticated.');
            setShowModal(true);
            return;
        }
        if (window.confirm(`Are you sure you want to delete this ${itemType} of BGN ${itemAmount?.toFixed(2) || ''}? This action cannot be undone.`)) {
            try {
                const projectId = auth.app.options.projectId;
                const itemRef = doc(db, `artifacts/${projectId}/users/${userId}/payments_expenses`, itemId);
                await deleteDoc(itemRef);
                setModalMessage(`${itemType} deleted successfully!`);
                setShowModal(true);
            } catch (error) {
                console.error("Error deleting payment/expense: ", error);
                setModalMessage(`Error deleting ${itemType}: ${error.message}`);
                setShowModal(true);
            }
        }
    };

    // Helper function to format dates as YYYY-MM-DD
    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    }, []); // Memoize this function since it's passed as a prop


    return (
        <div className="min-h-screen bg-[#F0F2F5] font-sans text-gray-800">
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                }
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                `}
            </style>
            {/* The Tailwind CSS CDN script tag is typically placed in public/index.html or as a PostCSS plugin */}
            {/* If you're using Create React App or a similar setup, you might already have Tailwind configured */}
            {/* If not, ensure this CDN link is in your public/index.html file or you've correctly set up Tailwind CLI/PostCSS */}
            {/* <script src="https://cdn.tailwindcss.com"></script> */}

            <div className="flex flex-col lg:flex-row min-h-screen">
                {/* Sidebar */}
                <aside className={`fixed lg:static inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out
                                w-56 bg-[#F8FAFC] text-gray-800 shadow-lg p-6 flex flex-col z-50`}>
                    <div className="flex items-center justify-between lg:justify-center mb-10">
                        <div className="flex flex-col items-center">
                            {/* Logo added here */}
                            <img src={Logo} alt="Company Logo" className="h-16 w-16 mb-2 object-contain" />
                            <h1 className="text-3xl font-extrabold text-gray-900 mt-2">Insurance</h1>
                        </div>
                        <button className="lg:hidden text-gray-600 text-2xl p-2" onClick={() => setIsSidebarOpen(false)}>
                            &times;
                        </button>
                    </div>

                    {user && ( // Only show navigation if logged in
                        <nav className="flex-grow space-y-2">
                            <button onClick={() => { setCurrentPage('dashboard'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'dashboard' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                                <span>Dashboard</span>
                            </button>
                            <button onClick={() => { setCurrentPage('addPolicy'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'addPolicy' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path></svg>
                                <span>Add Policy</span>
                            </button>
                            <button onClick={() => { setCurrentPage('viewPolicies'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'viewPolicies' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M7 3a1 1 0 00-1 1v1a1 1 0 002 0V4a1 1 0 00-1-1zM9 3a1 1 0 00-1 1v1a1 1 0 002 0V4a1 1 0 00-1-1zM11 3a1 1 0 00-1 1v1a1 1 0 002 0V4a1 1 0 00-1-1zM13 3a1 1 0 00-1 1v1a1 1 0 002 0V4a1 1 0 00-1-1z"></path><path fillRule="evenodd" d="M3 8a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5-3a1 1 0 00-2 0v1H5a1 1 0 000 2h1a1 1 0 001-1V5z" clipRule="evenodd"></path></svg>
                                <span>View Policies</span>
                            </button>
                            <button onClick={() => { setCurrentPage('addPaymentExpense'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'addPaymentExpense' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path></svg>
                                <span>Add Payment/Expense</span>
                            </button>
                            <button onClick={() => { setCurrentPage('financialReports'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'financialReports' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"></path><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"></path></svg>
                                <span>Reports</span>
                            </button>
                            <button onClick={() => { setCurrentPage('customerManagement'); setIsSidebarOpen(false); }}
                                className={`w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 transition duration-200
                                                ${currentPage === 'customerManagement' ? 'bg-[#EBF0F7] text-[#364152] font-semibold border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                <span>Customers</span>
                            </button>
                        </nav>
                    )}

                    {user && ( // Only show logout and user ID if logged in
                        <div className="mt-auto pt-4 border-t border-gray-300 text-gray-600 text-sm">
                            <p>Logged in as:</p>
                            <p className="font-semibold truncate">{user.email || userId}</p>
                            <button onClick={handleLogout} className="mt-2 text-blue-500 hover:underline">Logout</button>
                        </div>
                    )}
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 lg:ml-56 p-4 sm:p-6 md:p-8">
                    {/* Mobile Header/Hamburger Menu */}
                    <header className="lg:hidden flex items-center justify-between mb-8 p-4 bg-white rounded-xl shadow-sm">
                        <h1 className="text-2xl font-extrabold text-gray-900">Insurance</h1>
                        <button className="text-gray-600 text-2xl p-2" onClick={() => setIsSidebarOpen(true)}>
                            &#9776;
                        </button>
                    </header>

                    <main className="min-h-[calc(100vh-120px)]"> {/* Ensure main content area has min height */}
                        {isAuthReady ? (
                            user ? (
                                <>
                                    {currentPage === 'dashboard' && <Dashboard policies={policies} loadingPolicies={loadingPolicies} />}

                                    {currentPage === 'addPolicy' && (
                                        <div className="p-5 bg-white rounded-xl shadow-sm space-y-6">
                                            <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Add New Insurance Policy</h2>
                                            <form onSubmit={handleAddPolicy} className="space-y-6">
                                                <div className="border border-gray-200 rounded-lg p-5">
                                                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Policy Details</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label htmlFor="policyType" className="block text-sm font-medium text-gray-700">Policy Type</label>
                                                            <select id="policyType" value={policyType} onChange={(e) => setPolicyType(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                                                <option>New Policy</option>
                                                                <option>Policy Payment</option>
                                                                <option>Toll</option>
                                                                <option>Assessment</option>
                                                                <option>Sticker</option>
                                                                <option>Certificate</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label htmlFor="policyNumber" className="block text-sm font-medium text-gray-700">Policy Number <span className="text-red-500">*</span></label>
                                                            <input type="text" id="policyNumber" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="policyDate" className="block text-sm font-medium text-gray-700">Policy Date <span className="text-red-500">*</span></label>
                                                            <input type="date" id="policyDate" value={policyDate} onChange={(e) => setPolicyDate(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="validUntil" className="block text-sm font-medium text-gray-700">Valid Until <span className="text-red-500">*</span></label>
                                                            <input type="date" id="validUntil" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">Total Amount (BGN) <span className="text-red-500">*</span></label>
                                                            <input type="number" step="0.01" id="totalAmount" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="commission" className="block text-sm font-medium text-gray-700">Commission (BGN)</label>
                                                            <input type="number" step="0.01" id="commission" value={commission} onChange={(e) => setCommission(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700">Vehicle Number</label>
                                                            <input type="text" id="vehicleNumber" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="insuranceType" className="block text-sm font-medium text-gray-700">Insurance Type</label>
                                                            <input type="text" id="insuranceType" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <input type="checkbox" id="paidByCustomer" checked={paidByCustomer} onChange={(e) => setPaidByCustomer(e.target.checked)}
                                                                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                                            <label htmlFor="paidByCustomer" className="text-sm font-medium text-gray-700">Paid by Customer</label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <input type="checkbox" id="paidToInsurer" checked={paidToInsurer} onChange={(e) => setPaidToInsurer(e.target.checked)}
                                                                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                                            <label htmlFor="paidToInsurer" className="text-sm font-medium text-gray-700">Paid to Insurer</label>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Customer Information */}
                                                <div className="border border-gray-200 rounded-lg p-5">
                                                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Customer Information</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
                                                            <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                                                            <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                                                            <input type="text" id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700">ID Number</label>
                                                            <input type="text" id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                                                            <input type="text" id="address" value={address} onChange={(e) => setAddress(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                                                            <input type="text" id="city" value={city} onChange={(e) => setCity(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">Postal Code</label>
                                                            <input type="text" id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                                                                className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <button type="submit"
                                                    className="w-full bg-blue-600 text-white p-3 rounded-md shadow-lg hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105">
                                                    Add Policy
                                                </button>
                                            </form>
                                        </div>
                                    )}

                                    {currentPage === 'viewPolicies' && (
                                        <ViewPolicies
                                            policies={policies}
                                            paymentsExpenses={paymentsExpenses}
                                            loadingPolicies={loadingPolicies}
                                            loadingPaymentsExpenses={loadingPaymentsExpenses}
                                            filterPolicyType={filterPolicyType} setFilterPolicyType={setFilterPolicyType}
                                            filterCustomerName={filterCustomerName} setFilterCustomerName={setFilterCustomerName}
                                            filterPolicyNumber={filterPolicyNumber} setFilterPolicyNumber={setFilterPolicyNumber}
                                            filterPaidByCustomer={filterPaidByCustomer} setFilterPaidByCustomer={setFilterPaidByCustomer}
                                            filterPaidToInsurer={filterPaidToInsurer} setFilterPaidToInsurer={setFilterPaidToInsurer}
                                            filterValidUntilStartDate={filterValidUntilStartDate} setFilterValidUntilStartDate={setFilterValidUntilStartDate}
                                            filterValidUntilEndDate={filterValidUntilEndDate} setFilterValidUntilEndDate={setFilterValidUntilEndDate}
                                            sortColumn={sortColumn} setSortColumn={setSortColumn}
                                            sortDirection={sortDirection} setSortDirection={setSortDirection}
                                            expandedPolicyId={expandedPolicyId} setExpandedPolicyId={setExpandedPolicyId}
                                            handleDeletePolicy={handleDeletePolicy}
                                            // Pass functions needed by ViewPolicies for its actions and modals
                                            handleEditPolicyClick={(policy) => { // Define this handler to update App's state
                                                setSelectedPolicyForEdit(policy);
                                                setIsPolicyEditModalOpen(true);
                                            }}
                                            handleDeletePaymentExpense={handleDeletePaymentExpense}
                                            formatDate={formatDate}
                                            userId={userId}
                                        />
                                    )}

                                    {isPolicyEditModalOpen && (
                                        <EditPolicyModal
                                            policy={selectedPolicyForEdit}
                                            onClose={() => setIsPolicyEditModalOpen(false)}
                                            onSave={handleUpdatePolicy}
                                            formatDate={formatDate}
                                        />
                                    )}

                                    {currentPage === 'financialReports' && <FinancialReports policies={policies} paymentsExpenses={paymentsExpenses} loadingPolicies={loadingPolicies} loadingPaymentsExpenses={loadingPaymentsExpenses} formatDate={formatDate} />}

                                    {currentPage === 'addPaymentExpense' && (
                                        <AddPaymentExpenseForm
                                            policies={policies}
                                            paymentExpenseType={paymentExpenseType} setPaymentExpenseType={setPaymentExpenseType}
                                            paymentExpenseDate={paymentExpenseDate} setPaymentExpenseDate={setPaymentExpenseDate}
                                            paymentExpenseAmount={paymentExpenseAmount} setPaymentExpenseAmount={setPaymentExpenseAmount}
                                            paymentExpenseReason={paymentExpenseReason} setPaymentExpenseReason={setPaymentExpenseReason}
                                            selectedPolicyForPayment={selectedPolicyForPayment} setSelectedPolicyForPayment={setSelectedPolicyForPayment}
                                            handleAddPaymentExpense={handleAddPaymentExpense}
                                        />
                                    )}

                                    {currentPage === 'customerManagement' && (
                                        <CustomerManagement
                                            policies={policies}
                                            loadingPolicies={loadingPolicies}
                                            handleUpdateCustomer={handleUpdateCustomer}
                                            setIsCustomerEditModalOpen={setIsCustomerEditModalOpen}
                                            setSelectedCustomerForEdit={setSelectedCustomerForEdit}
                                        />
                                    )}

                                    {isCustomerEditModalOpen && (
                                        <EditCustomerModal
                                            customer={selectedCustomerForEdit}
                                            onClose={() => setIsCustomerEditModalOpen(false)}
                                            onSave={handleUpdateCustomer}
                                        />
                                    )}
                                </>
                            ) : (
                                // Login/Register form when not authenticated
                                <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-4">
                                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                                        <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
                                            {isLogin ? 'Login' : 'Register'}
                                        </h2>
                                        {authMessage && (
                                            <div className={`p-3 mb-4 rounded-md text-sm font-medium ${authMessage.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {authMessage}
                                            </div>
                                        )}
                                        <form onSubmit={handleAuth} className="space-y-4">
                                            <div>
                                                <label htmlFor="email" className="sr-only">Email</label>
                                                <input type="email" id="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label htmlFor="password" className="sr-only">Password</label>
                                                <input type="password" id="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <button type="submit"
                                                className="w-full bg-blue-600 text-white p-3 rounded-md font-semibold hover:bg-blue-700 transition duration-200">
                                                {isLogin ? 'Login' : 'Register'}
                                            </button>
                                        </form>
                                        <div className="mt-4 text-center">
                                            <button onClick={() => setIsLogin(!isLogin)}
                                                className="text-blue-600 hover:underline">
                                                {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            // Initializing application loader
                            <div className="flex justify-center items-center h-full text-blue-600 text-xl font-semibold">
                                <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Initializing application...
                            </div>
                        )}
                    </main>
                </div>
                <Modal message={modalMessage} onClose={() => { setShowModal(false); setModalMessage(''); }} />
            </div>
        </div>
    );
};

export default App;
