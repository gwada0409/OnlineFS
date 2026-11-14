import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileLeavePage } from './FileLeavePage';
const mocks=vi.hoisted(() => ({ options:vi.fn(), apply:vi.fn(), error:vi.fn(), success:vi.fn() }));
vi.mock('../components/ToastProvider',() => ({ useToast:() => ({error:mocks.error,success:mocks.success}) }));
vi.mock('../lib/api',() => ({ LeaveAPI:{getLineLeaderOptions:mocks.options,getTypes:async()=>[{id:1,code:'VL',description:'Vacation',isHoursBased:false,deductsFromBalance:false},{id:2,code:'SL',description:'Sick Leave',isHoursBased:false,deductsFromBalance:false}],getBalance:async()=>[],getHolidays:async()=>[],apply:mocks.apply},CalendarPolicyAPI:{getCalendar:async()=>({workCalendar:{workingDays:'1,2,3,4,5'}})},getApiErrorMessage:(_error:unknown,fallback:string)=>fallback }));
beforeEach(() => { vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}}); vi.resetAllMocks(); vi.spyOn(window,'scrollTo').mockImplementation(()=>{}); mocks.options.mockResolvedValue({requiresSelection:true,lineLeaders:[{id:3,fullName:'Leader Three'},{id:8,fullName:'Leader Eight'}]}); mocks.apply.mockResolvedValue({id:99}); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const open=async() => {render(<MemoryRouter><FileLeavePage/></MemoryRouter>);await screen.findByRole('option',{name:/Vacation/});fireEvent.change(screen.getByLabelText(/Type of Leave/),{target:{value:'1'}});await screen.findByLabelText(/Noted by/);};
describe('operator chooses department line leader at filing',() => {
 it('requires a selection and submits the selected leader',async()=>{
  await open(); fireEvent.click(screen.getByText('Next: Attachments'));
  expect(mocks.error).toHaveBeenCalledWith('Choose a department line leader to note your leave.');
  fireEvent.change(screen.getByLabelText(/Noted by/),{target:{value:'8'}});
  const date=new Date();date.setDate(date.getDate()+21);while([0,6].includes(date.getDay()))date.setDate(date.getDate()+1);
  const value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  fireEvent.change(document.getElementById('date-from')!,{target:{value}});fireEvent.change(document.getElementById('date-to')!,{target:{value}});
  fireEvent.change(document.getElementById('leave-reason')!,{target:{value:'Test leave'}});
  fireEvent.click(screen.getByText('Next: Attachments'));fireEvent.click(screen.getByText('Next: Review'));
  expect(screen.getByText('Leader Eight')).toBeInTheDocument();
  fireEvent.submit(document.querySelector('form')!);
  await waitFor(()=>expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({selectedLineLeaderId:8,leaveTypeId:1}),[]));
 });
 it('hides operator selection for SL and retains the department-designated SL workflow',async()=>{
  await open();fireEvent.change(screen.getByLabelText(/Type of Leave/),{target:{value:'2'}});
  expect(screen.queryByLabelText(/Noted by/)).not.toBeInTheDocument();
 });
 it('shows missing department configuration instead of silently skipping the leader',async()=>{
  mocks.options.mockResolvedValue({requiresSelection:true,lineLeaders:[]});await open();
  expect(screen.getByRole('alert')).toHaveTextContent('No department line leaders configured');
 });
});
