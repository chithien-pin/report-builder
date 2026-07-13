"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

import type { ColumnInfo } from "@/lib/types";

interface DataPreviewTableProps {
  preview: Record<string, unknown>[];
  columns: ColumnInfo[];
}

const dtypeLabel: Record<string, string> = {
  string: "Text",
  number: "Số",
  float: "Số thập phân",
  date: "Ngày",
  boolean: "Boolean",
};

export function DataPreviewTable({ preview, columns }: DataPreviewTableProps) {
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.name,
        header: () => (
          <div>
            <div className="font-medium">{col.original_name}</div>
            <div className="text-xs font-normal text-muted-foreground">{dtypeLabel[col.dtype] ?? col.dtype}</div>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (value == null) return <span className="text-muted-foreground">—</span>;
          return String(value);
        },
      })),
    [columns],
  );

  const table = useReactTable({
    data: preview,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/60">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="whitespace-nowrap px-4 py-3 text-left align-top">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-border/70">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-4 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
