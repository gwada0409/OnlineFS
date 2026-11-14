import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DepartmentAPI, 
  CategoryAPI, 
  HRAPI, 
  type ApprovalCategoryNode, 
  type DepartmentNode, 
  type HREmployee 
} from '../lib/api';
import { getApiErrorMessage } from '../lib/api';
import { CategoryTree } from './DepartmentManagement/CategoryTree';
import { CategoryDetailsPanel } from './DepartmentManagement/CategoryDetailsPanel';
import { UnitDetailsPanel } from './DepartmentManagement/UnitDetailsPanel';
import { AddEditCategoryModal } from './DepartmentManagement/AddEditCategoryModal';
import { AddEditUnitModal } from './DepartmentManagement/AddEditUnitModal';
import { MoveDepartmentModal } from './DepartmentManagement/MoveDepartmentModal';
import { SetCategoryApproverModal } from './DepartmentManagement/SetCategoryApproverModal';
import { SetFirstApproverModal } from './DepartmentManagement/SetFirstApproverModal';
import { ManageEmployeesDrawer } from './DepartmentManagement/ManageEmployeesDrawer';
import { DeleteUnitDialog } from './DepartmentManagement/DeleteUnitDialog';
import { 
  Layers,
  RefreshCw,
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import { NotificationService } from '../services/notificationService';

export const DepartmentManagementPage: React.FC = () => {
  const [categories, setCategories] = useState<ApprovalCategoryNode[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection State
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  // Modal States
  const [isAddEditCategoryOpen, setIsAddEditCategoryOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ApprovalCategoryNode | null>(null);

  const [isAddEditDeptOpen, setIsAddEditDeptOpen] = useState(false);
  const [deptToEdit, setDeptToEdit] = useState<DepartmentNode | null>(null);
  const [focusBackups, setFocusBackups] = useState(false);
  const [defaultCatIdForDept, setDefaultCatIdForDept] = useState<number | null>(null);

  const [isMoveDeptOpen, setIsMoveDeptOpen] = useState(false);
  const [deptToMove, setDeptToMove] = useState<DepartmentNode | null>(null);

  const [isChangeCatApproverOpen, setIsChangeCatApproverOpen] = useState(false);
  const [catForApprover, setCatForApprover] = useState<ApprovalCategoryNode | null>(null);

  const [isChangeDeptApproverOpen, setIsChangeDeptApproverOpen] = useState(false);
  const [deptForApprover, setDeptForApprover] = useState<DepartmentNode | null>(null);

  const [isManageEmployeesOpen, setIsManageEmployeesOpen] = useState(false);
  const [deptForEmployees, setDeptForEmployees] = useState<DepartmentNode | null>(null);

  const [isDeleteDeptOpen, setIsDeleteDeptOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentNode | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [hierarchyData, employeesData] = await Promise.all([
        DepartmentAPI.getHierarchy(true),
        HRAPI.getEmployees()
      ]);

      setCategories(hierarchyData);
      setEmployees(employeesData);

      // Auto-select first category if none selected
      if (hierarchyData.length > 0 && selectedCategoryId === null && selectedDepartmentId === null) {
        setSelectedCategoryId(hierarchyData[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load organizational hierarchy:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load organizational hierarchy');
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, selectedDepartmentId]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeOrganizationChanges(() => void loadData());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadData();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadData]);

  // Resolved Current Selected Objects
  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === null) return categories[0] || null;
    return categories.find(c => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const selectedDepartment = useMemo(() => {
    if (selectedDepartmentId === null) return null;
    for (const c of categories) {
      const found = c.departments.find(d => d.id === selectedDepartmentId);
      if (found) return found;
    }
    return null;
  }, [categories, selectedDepartmentId]);

  // Selection Handlers
  const handleSelectCategory = (cat: ApprovalCategoryNode) => {
    setSelectedCategoryId(cat.id);
    setSelectedDepartmentId(null);
  };

  const handleSelectDepartment = (dept: DepartmentNode, cat: ApprovalCategoryNode) => {
    setSelectedCategoryId(cat.id);
    setSelectedDepartmentId(dept.id);
  };

  const handleReorderHierarchy = async (nextCategories: ApprovalCategoryNode[]) => {
    const previous = categories;
    setCategories(nextCategories);
    try {
      await DepartmentAPI.reorderHierarchy({
        categoryIds: nextCategories.flatMap(category => category.id === null ? [] : [category.id]),
        groups: nextCategories.map(category => ({
          categoryId: category.id,
          departmentIds: category.departments.map(department => department.id)
        }))
      });
      showSuccess('Approval hierarchy order updated.');
    } catch (err: any) {
      setCategories(previous);
      setError(err?.response?.data?.message || err?.response?.data || err?.message || 'Failed to reorder approval hierarchy');
      await loadData();
    }
  };

  // --- Category Actions ---
  const handleOpenAddCategory = () => {
    setCategoryToEdit(null);
    setIsAddEditCategoryOpen(true);
  };

  const handleOpenEditCategory = (cat: ApprovalCategoryNode) => {
    setCategoryToEdit(cat);
    setIsAddEditCategoryOpen(true);
  };

  const handleSaveCategory = async (data: {
    name: string;
    description?: string;
    secondApproverId?: number | null;
    isActive?: boolean;
  }) => {
    if (categoryToEdit && categoryToEdit.id) {
      await CategoryAPI.update(categoryToEdit.id, data);
      showSuccess(`Approval category '${data.name}' updated.`);
    } else {
      const created = await CategoryAPI.create(data);
      setSelectedCategoryId(created.id);
      setSelectedDepartmentId(null);
      showSuccess(`Approval category '${data.name}' created.`);
    }
    await loadData();
  };

  const handleDeleteCategory = async (cat: ApprovalCategoryNode) => {
    if (!cat.id) return;
    if (window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) {
      try {
        await CategoryAPI.delete(cat.id);
        showSuccess(`Category '${cat.name}' deleted.`);
        setSelectedCategoryId(null);
        setSelectedDepartmentId(null);
        await loadData();
      } catch (err: any) {
        alert(err?.response?.data?.message || err?.message || 'Cannot delete category with active departments.');
      }
    }
  };

  const handleOpenChangeCategoryApprover = (cat: ApprovalCategoryNode) => {
    setCatForApprover(cat);
    setIsChangeCatApproverOpen(true);
  };

  const handleSaveCategoryApprover = async (categoryId: number, secondApproverId: number | null) => {
    await CategoryAPI.setApprover(categoryId, { secondApproverId });
    showSuccess('Category Approver updated successfully.');
    await loadData();
  };

  // --- Department Actions ---
  const handleOpenAddDepartment = (defaultCatId?: number) => {
    setDeptToEdit(null);
    setDefaultCatIdForDept(defaultCatId ?? selectedCategoryId);
    setIsAddEditDeptOpen(true);
  };

  const handleOpenEditDepartment = (dept: DepartmentNode, openBackups = false) => {
    setFocusBackups(openBackups);
    setDeptToEdit(dept);
    setIsAddEditDeptOpen(true);
  };

  const handleSaveDepartment = async (data: {
    name: string;
    description?: string;
    categoryId?: number | null;
    firstApproverId?: number | null;
    firstApproverIds?: number[];
    notedByApproverIds?: number[];
    backupApprovers?: { notedBy: number | null; recommending: number | null; approver: number | null };
    requiresOperatorLineLeader?: boolean;
    sickLeaveLineLeaderId?: number | null;
    operatorLineLeaderAssignments?: Record<number, number | null>;

    secondApproverOverrideId?: number | null;
    isActive?: boolean;
  }) => {
    if (deptToEdit) {
      await DepartmentAPI.update(deptToEdit.id, data);
      showSuccess(`Department '${data.name}' updated.`);
    } else {
      const created = await DepartmentAPI.create(data);
      if (data.categoryId) setSelectedCategoryId(data.categoryId);
      setSelectedDepartmentId(created.id);
      showSuccess(`Department '${data.name}' created.`);
    }
    await loadData();
  };

  const handleOpenMoveDepartment = (dept: DepartmentNode) => {
    setDeptToMove(dept);
    setIsMoveDeptOpen(true);
  };

  const handleConfirmMoveDepartment = async (departmentId: number, targetCategoryId: number | null) => {
    await DepartmentAPI.assignCategory(departmentId, { categoryId: targetCategoryId });
    if (targetCategoryId) setSelectedCategoryId(targetCategoryId);
    showSuccess('Department moved to new approval category.');
    await loadData();
  };

  const handleOpenChangeFirstApprover = (dept: DepartmentNode) => {
    setDeptForApprover(dept);
    setIsChangeDeptApproverOpen(true);
  };

  const handleSaveFirstApprover = async (departmentId: number, firstApproverIds: number[]) => {
    await DepartmentAPI.setFirstApprover(departmentId, { firstApproverIds });
    showSuccess('Department Recommending role updated successfully.');
    await loadData();
  };

  const handleOpenManageEmployees = (dept: DepartmentNode) => {
    setDeptForEmployees(dept);
    setIsManageEmployeesOpen(true);
  };

  const handleSaveEmployeesBatch = async (deptId: number, selectedEmployeeIds: number[]) => {
    await DepartmentAPI.assignEmployeesBatch(deptId, { selectedEmployeeIds });
    showSuccess('Department employee assignments updated.');
    await loadData();
  };

  const handleUnassignEmployee = async (deptId: number, employeeId: number) => {
    try {
      setError(null);
      await DepartmentAPI.unassignEmployee(deptId, employeeId);
      showSuccess('Employee removed from department.');
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to remove employee from department.'));
      throw err;
    }
  };

  const handleOpenDeleteDepartment = (dept: DepartmentNode) => {
    setDeptToDelete(dept);
    setIsDeleteDeptOpen(true);
  };

  const handleConfirmDeleteDepartment = async (deptId: number) => {
    await DepartmentAPI.delete(deptId);
    showSuccess('Department deleted successfully.');
    setSelectedDepartmentId(null);
    await loadData();
  };

  return (
    <div className="department-workspace animate-fade-in space-y-3">
      <div className="flex justify-end">
        <button
          className="btn btn-outline btn-sm text-xs flex items-center gap-1.5"
          onClick={loadData}
          disabled={loading}
          title="Refresh structure"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="alert alert-success p-3 text-xs rounded-xl flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle size={16} className="text-success shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger p-3 text-xs rounded-xl flex items-center gap-2 animate-fade-in shadow-sm">
          <AlertCircle size={16} className="text-danger shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two-Column Main Layout */}
      <div className="department-workspace-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Category & Department Tree (4 cols) */}
        <div className="department-workspace-panel lg:col-span-4">
        <CategoryTree
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            selectedDepartmentId={selectedDepartmentId}
            onSelectCategory={handleSelectCategory}
            onSelectDepartment={handleSelectDepartment}
            onAddCategory={handleOpenAddCategory}
          onAddDepartment={handleOpenAddDepartment}
          onReorderHierarchy={handleReorderHierarchy}
        />
        </div>

        {/* Right Column: Details Panel (8 cols) */}
        <div className="department-workspace-panel lg:col-span-8">
          {selectedDepartment ? (
            <UnitDetailsPanel
              employees={employees}
              unit={selectedDepartment}
              category={selectedCategory}
              onEditUnit={handleOpenEditDepartment}
              onDeleteUnit={handleOpenDeleteDepartment}
              onManageEmployees={handleOpenManageEmployees}
              onMoveCategory={handleOpenMoveDepartment}
              onChangeFirstApprover={handleOpenChangeFirstApprover}
              onUnassignEmployee={handleUnassignEmployee}
            />
          ) : selectedCategory ? (
            <CategoryDetailsPanel
              category={selectedCategory}
              onEditCategory={handleOpenEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onChangeApprover={handleOpenChangeCategoryApprover}
              onAddDepartment={handleOpenAddDepartment}
              onSelectDepartment={(dept) => handleSelectDepartment(dept, selectedCategory)}
              onEditDepartment={handleOpenEditDepartment}
              onMoveDepartment={handleOpenMoveDepartment}
              onManageEmployees={handleOpenManageEmployees}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-surface rounded-2xl border border-border p-10 text-center space-y-4">
              <Layers size={48} className="text-muted/40" />
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Select an Approval Category or Department
                </h3>
                <p className="text-xs text-muted max-w-sm mt-1">
                  Choose an item from the left hierarchy to inspect approver settings, member lists, and route preview.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Modal Dialogs */}
      <AddEditCategoryModal
        isOpen={isAddEditCategoryOpen}
        onClose={() => setIsAddEditCategoryOpen(false)}
        onSubmit={handleSaveCategory}
        categoryToEdit={categoryToEdit}
        employees={employees}
      />

      <AddEditUnitModal
        isOpen={isAddEditDeptOpen}
        onClose={() => setIsAddEditDeptOpen(false)}
        onSubmit={handleSaveDepartment}
        unitToEdit={deptToEdit}
        focusBackups={Boolean(deptToEdit) && focusBackups}
        categories={categories}
        employees={employees}
        defaultCategoryId={defaultCatIdForDept}
      />

      <MoveDepartmentModal
        isOpen={isMoveDeptOpen}
        onClose={() => setIsMoveDeptOpen(false)}
        department={deptToMove}
        categories={categories}
        onMove={handleConfirmMoveDepartment}
      />

      <SetCategoryApproverModal
        isOpen={isChangeCatApproverOpen}
        onClose={() => setIsChangeCatApproverOpen(false)}
        category={catForApprover}
        employees={employees}
        onSave={handleSaveCategoryApprover}
      />

      <SetFirstApproverModal
        isOpen={isChangeDeptApproverOpen}
        onClose={() => setIsChangeDeptApproverOpen(false)}
        department={deptForApprover}
        employees={employees}
        onSave={handleSaveFirstApprover}
      />

      <ManageEmployeesDrawer
        isOpen={isManageEmployeesOpen}
        onClose={() => setIsManageEmployeesOpen(false)}
        selectedUnit={deptForEmployees}
        allEmployees={employees}
        onSaveAssignments={handleSaveEmployeesBatch}
      />

      <DeleteUnitDialog
        isOpen={isDeleteDeptOpen}
        onClose={() => setIsDeleteDeptOpen(false)}
        unit={deptToDelete}
        onConfirmDelete={handleConfirmDeleteDepartment}
        onOpenManageEmployees={() => {
          setIsDeleteDeptOpen(false);
          if (deptToDelete) handleOpenManageEmployees(deptToDelete);
        }}
      />
    </div>
  );
};
