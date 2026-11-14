import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Users, ShieldCheck } from 'lucide-react';
import type { DepartmentNode, DepartmentMember } from '../../lib/api';

interface OrganizationTreeProps {
  tree: DepartmentNode[];
  selectedUnitId: number | null;
  onSelectUnit: (unitId: number) => void;
}

export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  tree,
  selectedUnitId,
  onSelectUnit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(() => {
    // By default expand all root nodes
    return new Set(tree.map(n => n.id));
  });

  const toggleExpand = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<number>();
    const collectIds = (nodes: DepartmentNode[]) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        if (n.children) collectIds(n.children);
      });
    };
    collectIds(tree);
    setExpandedNodeIds(allIds);
  };

  const collapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  // Search filtering logic
  const { filteredTree, matchingNodeIds } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { filteredTree: tree, matchingNodeIds: new Set<number>() };
    }

    const q = searchTerm.toLowerCase();
    const matches = new Set<number>();

    // Helper: checks if node or its descendants or its employees match
    const checkNode = (node: DepartmentNode): boolean => {
      if (!node) return false;
      const nameMatch = (node.name || '').toLowerCase().includes(q);
      const empMatch = (node.employees || []).some(
        (e: DepartmentMember) =>
          Boolean(e && ((e.fullName || '').toLowerCase().includes(q) || (e.employeeID || '').toLowerCase().includes(q)))
      );
      const childMatch = (node.children || []).some(checkNode);

      if (nameMatch || empMatch || childMatch) {
        matches.add(node.id);
        return true;
      }
      return false;
    };

    tree.forEach(checkNode);

    // Auto-expand all matching nodes
    return { filteredTree: tree, matchingNodeIds: matches };
  }, [tree, searchTerm]);

  // Render recursive tree node
  const renderNode = (node: DepartmentNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id) || searchTerm.trim().length > 0;
    const isSelected = selectedUnitId === node.id;
    const isMatch = matchingNodeIds.size === 0 || matchingNodeIds.has(node.id);

    if (searchTerm.trim() && !isMatch) {
      return null;
    }

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectUnit(node.id)}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          className={`group flex items-center justify-between py-2.5 pr-3 my-1 rounded-lg cursor-pointer transition-all ${
            isSelected
              ? 'bg-primary/15 text-primary font-semibold shadow-xs border border-primary/30'
              : 'hover:bg-muted/40 text-foreground border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground/40 text-[10px]">
                &bull;
              </span>
            )}

            <span className="truncate text-xs tracking-tight" title={node.name}>
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {node.employeeCount > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                  isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}
                title={`${node.employeeCount} assigned employees`}
              >
                <Users size={11} />
                {node.employeeCount}
              </span>
            )}
            {node.approvers && node.approvers.length > 0 && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-md bg-info/15 text-info flex items-center gap-1 font-medium"
                title={`${node.approvers.length} configured approvers`}
              >
                <ShieldCheck size={11} />
                {node.approvers.length}
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Tree branch indent guide */}
            <div
              className="absolute top-0 bottom-1 border-l border-border/60"
              style={{ left: `${depth * 16 + 20}px` }}
            />
            <div>
              {node.children!.map((child) =>
                renderNode(child, depth + 1)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search departments or employees..."
            className="input w-full pl-8.5 py-2 text-xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span className="font-medium uppercase tracking-wider text-[10px]">Hierarchy Tree</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hover:text-foreground text-[11px] hover:underline"
              onClick={expandAll}
            >
              Expand All
            </button>
            <span className="text-border">&bull;</span>
            <button
              type="button"
              className="hover:text-foreground text-[11px] hover:underline"
              onClick={collapseAll}
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree Node List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {filteredTree.length > 0 ? (
          filteredTree.map((rootNode) =>
            renderNode(rootNode, 0)
          )
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No departments found matching "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};
