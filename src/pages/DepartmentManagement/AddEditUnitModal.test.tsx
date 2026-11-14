import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddEditUnitModal } from './AddEditUnitModal';
const operator = { id:1, employeeID:'OP1', fullName:'Operator One', position:'Operator', leaveDepartmentId:10, regularLineLeaderId:2 };
const employees = [operator,{id:2,employeeID:'LL2',fullName:'Regular Leader'},{id:3,employeeID:'SL3',fullName:'SL Leader'}] as any;
const categories = [{id:1,name:'Category',departments:[]}] as any;
afterEach(cleanup);
describe('line leader configuration', () => {
  it('loads SL assignment and saves eligible department leaders independently', async () => {
    const save=vi.fn().mockResolvedValue(undefined);
    render(<AddEditUnitModal isOpen onClose={() => {}} onSubmit={save} employees={employees} categories={categories} unitToEdit={{id:10,name:'Production',categoryId:1,isActive:true,requiresOperatorLineLeader:true,sickLeaveLineLeaderId:3,notedByApproverIds:[2]} as any}/>);
    expect(screen.getByLabelText('Require Operator to choose a department line leader for normal leave')).toBeChecked();
    expect(screen.getByLabelText('SL designated line leader (operators only)')).toHaveValue('3');
    const pool=within(screen.getByRole('group',{name:'Department line leaders / Noted by'}));
    expect(pool.getByLabelText(/Regular Leader/)).toBeChecked();
    fireEvent.click(pool.getByLabelText(/SL Leader/));
    fireEvent.click(screen.getByText('Save Department'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({requiresOperatorLineLeader:true,sickLeaveLineLeaderId:3,notedByApproverIds:[2,3]})));
  });
  it('defaults regular-leave opt-in to off and SL leader to unconfigured', () => {
    render(<AddEditUnitModal isOpen onClose={() => {}} onSubmit={vi.fn()} employees={employees} categories={categories}/>);
    expect(screen.getByLabelText('Require Operator to choose a department line leader for normal leave')).not.toBeChecked();
    expect(screen.getByLabelText('SL designated line leader (operators only)')).toHaveValue('');
    expect(screen.queryByLabelText('Operator One — regular leave line leader')).not.toBeInTheDocument();
  });
  it('edits stage backups independently and can clear an existing backup', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AddEditUnitModal isOpen onClose={() => {}} onSubmit={save} employees={employees} categories={categories}
      unitToEdit={{ id: 10, name: 'Production', categoryId: 1, isActive: true, notedByApproverIds: [2], firstApproverIds: [3], backupApprovers: { notedBy: 3, recommending: 2, approver: 3 } } as any} />);
    expect(screen.getByLabelText('Noted by / Line leader backup')).toHaveValue('3');
    fireEvent.change(screen.getByLabelText('Noted by / Line leader backup'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Approver / 2nd approver backup'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Save Department'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      notedByApproverIds: [2], firstApproverIds: [3], backupApprovers: { notedBy: null, recommending: 2, approver: 2 },
    })));
  });
});
