import React, { Suspense, lazy } from "react";
import BaseWidget, { WidgetProps, WidgetState } from "./BaseWidget";
import { WidgetType } from "constants/WidgetConstants";
import { EventType } from "constants/ActionConstants";
import {
  compare,
  getAllTableColumnKeys,
  renderCell,
  renderActions,
  reorderColumns,
  sortTableFunction,
  ConditionFunctions,
} from "components/designSystems/appsmith/TableUtilities";
import { VALIDATION_TYPES } from "constants/WidgetValidation";
import { RenderModes } from "constants/WidgetConstants";
import {
  WidgetPropertyValidationType,
  BASE_WIDGET_VALIDATION,
} from "utils/ValidationFactory";
import { ColumnAction } from "components/propertyControls/ColumnActionSelectorControl";
import { TriggerPropertiesMap } from "utils/WidgetFactory";
import Skeleton from "components/utils/Skeleton";
import moment from "moment";
import * as Sentry from "@sentry/react";

const ReactTableComponent = lazy(() =>
  import("components/designSystems/appsmith/ReactTableComponent"),
);

export type TableSizes = {
  COLUMN_HEADER_HEIGHT: number;
  TABLE_HEADER_HEIGHT: number;
  ROW_HEIGHT: number;
  ROW_FONT_SIZE: number;
};

export enum CompactModeTypes {
  SHORT = "SHORT",
  DEFAULT = "DEFAULT",
  TALL = "TALL",
}

export const TABLE_SIZES: { [key: string]: TableSizes } = {
  [CompactModeTypes.DEFAULT]: {
    COLUMN_HEADER_HEIGHT: 38,
    TABLE_HEADER_HEIGHT: 42,
    ROW_HEIGHT: 40,
    ROW_FONT_SIZE: 14,
  },
  [CompactModeTypes.SHORT]: {
    COLUMN_HEADER_HEIGHT: 38,
    TABLE_HEADER_HEIGHT: 42,
    ROW_HEIGHT: 20,
    ROW_FONT_SIZE: 12,
  },
  [CompactModeTypes.TALL]: {
    COLUMN_HEADER_HEIGHT: 38,
    TABLE_HEADER_HEIGHT: 42,
    ROW_HEIGHT: 60,
    ROW_FONT_SIZE: 18,
  },
};

export enum ColumnTypes {
  CURRENCY = "currency",
  TIME = "time",
  DATE = "date",
  VIDEO = "video",
  IMAGE = "image",
  TEXT = "text",
  NUMBER = "number",
}

export enum OperatorTypes {
  OR = "OR",
  AND = "AND",
}
class TableWidget extends BaseWidget<TableWidgetProps, WidgetState> {
  static getPropertyValidationMap(): WidgetPropertyValidationType {
    return {
      ...BASE_WIDGET_VALIDATION,
      tableData: VALIDATION_TYPES.TABLE_DATA,
      nextPageKey: VALIDATION_TYPES.TEXT,
      prevPageKey: VALIDATION_TYPES.TEXT,
      label: VALIDATION_TYPES.TEXT,
      searchText: VALIDATION_TYPES.TEXT,
      defaultSearchText: VALIDATION_TYPES.TEXT,
    };
  }

  static getMetaPropertiesMap(): Record<string, any> {
    return {
      pageNo: 1,
      pageSize: undefined,
      selectedRowIndex: -1,
      selectedRowIndexes: "",
      searchText: undefined,
      selectedRow: {},
      selectedRows: [],
      // The following meta property is used for rendering the table.
      filteredTableData: undefined,
    };
  }

  static getDefaultPropertiesMap(): Record<string, string> {
    return {
      searchText: "defaultSearchText",
    };
  }

  static getTriggerPropertyMap(): TriggerPropertiesMap {
    return {
      onRowSelected: true,
      onPageChange: true,
      onSearchTextChanged: true,
    };
  }

  getTableColumns = (tableData: object[]) => {
    let columns: ReactTableColumnProps[] = [];
    const hiddenColumns: ReactTableColumnProps[] = [];
    const {
      columnNameMap,
      columnSizeMap,
      columnTypeMap,
      columnActions,
    } = this.props;
    if (tableData.length) {
      const columnKeys: string[] = getAllTableColumnKeys(tableData);
      const sortedColumn = this.props.sortedColumn;
      for (let index = 0; index < columnKeys.length; index++) {
        const i = columnKeys[index];
        const columnName: string =
          columnNameMap && columnNameMap[i] ? columnNameMap[i] : i;
        const columnType: { type: string; format?: string } =
          columnTypeMap && columnTypeMap[i]
            ? columnTypeMap[i]
            : { type: ColumnTypes.TEXT };
        const columnSize: number =
          columnSizeMap && columnSizeMap[i] ? columnSizeMap[i] : 150;
        const isHidden =
          !!this.props.hiddenColumns && this.props.hiddenColumns.includes(i);
        const columnData = {
          Header: columnName,
          accessor: i,
          width: columnSize,
          minWidth: 60,
          draggable: true,
          isHidden: false,
          isAscOrder:
            sortedColumn && sortedColumn.column === i
              ? sortedColumn.asc
              : undefined,
          metaProperties: {
            isHidden: isHidden,
            type: columnType.type,
            format: columnType.format,
          },
          Cell: (props: any) => {
            return renderCell(props.cell.value, columnType.type, isHidden);
          },
        };
        if (isHidden) {
          columnData.isHidden = true;
          hiddenColumns.push(columnData);
        } else {
          columns.push(columnData);
        }
      }
      columns = reorderColumns(columns, this.props.columnOrder || []);
      if (columnActions?.length) {
        columns.push({
          Header:
            columnNameMap && columnNameMap["actions"]
              ? columnNameMap["actions"]
              : "Actions",
          accessor: "actions",
          width: 150,
          minWidth: 60,
          draggable: true,
          Cell: (props: any) => {
            return renderActions({
              isSelected: props.row.isSelected,
              columnActions: columnActions,
              onCommandClick: this.onCommandClick,
            });
          },
        });
      }
      if (
        hiddenColumns.length &&
        this.props.renderMode === RenderModes.CANVAS
      ) {
        columns = columns.concat(hiddenColumns);
      }
    }
    return columns;
  };

  transformData = (tableData: object[], columns: ReactTableColumnProps[]) => {
    const updatedTableData = [];
    for (let row = 0; row < tableData.length; row++) {
      const data: { [key: string]: any } = tableData[row];
      const tableRow: { [key: string]: any } = {};
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const { accessor } = column;
        const value = data[accessor];
        if (column.metaProperties) {
          const type = column.metaProperties.type;
          const format = column.metaProperties.format;
          switch (type) {
            case ColumnTypes.CURRENCY:
              if (!isNaN(value)) {
                tableRow[accessor] = `${format}${value ? value : ""}`;
              } else {
                tableRow[accessor] = "Invalid Value";
              }
              break;
            case ColumnTypes.DATE:
              let isValidDate = true;
              if (isNaN(value)) {
                const dateTime = Date.parse(value);
                if (isNaN(dateTime)) {
                  isValidDate = false;
                }
              }
              if (isValidDate) {
                tableRow[accessor] = moment(value).format(format);
              } else if (value) {
                tableRow[accessor] = "Invalid Value";
              } else {
                tableRow[accessor] = "";
              }
              break;
            case ColumnTypes.TIME:
              let isValidTime = true;
              if (isNaN(value)) {
                const time = Date.parse(value);
                if (isNaN(time)) {
                  isValidTime = false;
                }
              }
              if (isValidTime) {
                tableRow[accessor] = moment(value).format("HH:mm");
              } else if (value) {
                tableRow[accessor] = "Invalid Value";
              } else {
                tableRow[accessor] = "";
              }
              break;
            default:
              tableRow[accessor] = value;
              break;
          }
        }
      }
      updatedTableData.push(tableRow);
    }
    return updatedTableData;
  };

  filterTableData = () => {
    const { searchText, sortedColumn, filters, tableData } = this.props;
    const columns = this.getTableColumns(tableData);
    if (!tableData || !tableData.length) {
      return [];
    }
    let sortedTableData = [];
    const searchKey = searchText ? searchText.toUpperCase() : "";
    if (sortedColumn) {
      const sortColumn = sortedColumn.column;
      const sortOrder = sortedColumn.asc;
      sortedTableData = sortTableFunction(
        tableData,
        columns,
        sortColumn,
        sortOrder,
      );
    } else {
      sortedTableData = [...tableData];
    }
    const filteredTableData = sortedTableData.filter(
      (item: { [key: string]: any }) => {
        const searchFound = searchKey
          ? Object.values(item)
              .join(", ")
              .toUpperCase()
              .includes(searchKey)
          : true;
        if (!searchFound) return false;
        if (!filters || filters.length === 0) return true;
        const filterOperator: Operator =
          filters.length >= 2 ? filters[1].operator : OperatorTypes.OR;
        let filter = filterOperator === OperatorTypes.AND ? true : false;
        for (let i = 0; i < filters.length; i++) {
          const filterValue = compare(
            item[filters[i].column],
            filters[i].value,
            filters[i].condition,
          );
          if (filterOperator === OperatorTypes.AND) {
            filter = filter && filterValue;
          } else {
            filter = filter || filterValue;
          }
        }
        return filter;
      },
    );
    return filteredTableData;
  };

  getSelectedRow = (filteredTableData: object[], selectedRowIndex?: number) => {
    if (selectedRowIndex === undefined || selectedRowIndex === -1) {
      const columnKeys: string[] = getAllTableColumnKeys(this.props.tableData);
      const selectedRow: { [key: string]: any } = {};
      for (let i = 0; i < columnKeys.length; i++) {
        selectedRow[columnKeys[i]] = undefined;
      }
      return selectedRow;
    }
    return filteredTableData[selectedRowIndex];
  };

  componentDidMount() {
    const filteredTableData = this.filterTableData();
    super.updateWidgetMetaProperty("filteredTableData", filteredTableData);
    const { selectedRowIndex } = this.props;
    super.updateWidgetMetaProperty(
      "selectedRow",
      this.getSelectedRow(filteredTableData, selectedRowIndex),
    );
  }
  componentDidUpdate(prevProps: TableWidgetProps) {
    if (
      JSON.stringify(this.props.tableData) !==
        JSON.stringify(prevProps.tableData) ||
      JSON.stringify(this.props.filters) !==
        JSON.stringify(prevProps.filters) ||
      this.props.searchText !== prevProps.searchText ||
      JSON.stringify(this.props.sortedColumn) !==
        JSON.stringify(prevProps.sortedColumn) ||
      !this.props.filteredTableData
    ) {
      const filteredTableData = this.filterTableData();
      super.updateWidgetMetaProperty("filteredTableData", filteredTableData);
      if (!this.props.multiRowSelection) {
        super.updateWidgetMetaProperty(
          "selectedRow",
          this.getSelectedRow(filteredTableData),
        );
      } else {
        const selectedRowIndexes = this.getSelectedRowIndexes(
          this.props.selectedRowIndexes,
        );
        super.updateWidgetMetaProperty(
          "selectedRows",
          filteredTableData.filter((item: object, i: number) => {
            return selectedRowIndexes.includes(i);
          }),
        );
      }
    }
    if (this.props.multiRowSelection !== prevProps.multiRowSelection) {
      if (this.props.multiRowSelection) {
        const selectedRowIndexes = this.props.selectedRowIndex
          ? [this.props.selectedRowIndex]
          : [];
        super.updateWidgetMetaProperty(
          "selectedRowIndexes",
          selectedRowIndexes.join(","),
        );
        super.updateWidgetMetaProperty("selectedRowIndex", -1);
        const filteredTableData = this.filterTableData();
        super.updateWidgetMetaProperty(
          "selectedRows",
          filteredTableData.filter((item: object, i: number) => {
            return selectedRowIndexes.includes(i);
          }),
        );
        super.updateWidgetMetaProperty(
          "selectedRow",
          this.getSelectedRow(filteredTableData),
        );
      } else {
        const filteredTableData = this.filterTableData();
        super.updateWidgetMetaProperty("selectedRowIndexes", "");
        super.updateWidgetMetaProperty("selectedRows", []);
        super.updateWidgetMetaProperty(
          "selectedRow",
          this.getSelectedRow(filteredTableData),
        );
      }
    }
  }

  getSelectedRowIndexes = (selectedRowIndexes: string) => {
    return selectedRowIndexes
      ? selectedRowIndexes.split(",").map(i => Number(i))
      : [];
  };

  getPageView() {
    const {
      tableData,
      hiddenColumns,
      filteredTableData,
      selectedRowIndexes,
    } = this.props;
    const tableColumns = this.getTableColumns(tableData);

    const transformedData = this.transformData(
      filteredTableData || [],
      tableColumns,
    );
    const serverSidePaginationEnabled = (this.props
      .serverSidePaginationEnabled &&
      this.props.serverSidePaginationEnabled) as boolean;
    let pageNo = this.props.pageNo;

    if (pageNo === undefined) {
      pageNo = 1;
      super.updateWidgetMetaProperty("pageNo", pageNo);
    }
    const { componentWidth, componentHeight } = this.getComponentDimensions();
    const tableSizes =
      TABLE_SIZES[this.props.compactMode || CompactModeTypes.DEFAULT];
    let pageSize = Math.floor(
      (componentHeight -
        tableSizes.TABLE_HEADER_HEIGHT -
        tableSizes.COLUMN_HEADER_HEIGHT) /
        tableSizes.ROW_HEIGHT,
    );
    if (
      componentHeight -
        (tableSizes.TABLE_HEADER_HEIGHT +
          tableSizes.COLUMN_HEADER_HEIGHT +
          tableSizes.ROW_HEIGHT * pageSize) >
      0
    )
      pageSize += 1;

    if (pageSize !== this.props.pageSize) {
      super.updateWidgetMetaProperty("pageSize", pageSize);
    }
    return (
      <Suspense fallback={<Skeleton />}>
        <ReactTableComponent
          height={componentHeight}
          width={componentWidth}
          tableData={transformedData}
          columns={tableColumns}
          isLoading={this.props.isLoading}
          widgetId={this.props.widgetId}
          widgetName={this.props.widgetName}
          searchKey={this.props.searchText}
          editMode={this.props.renderMode === RenderModes.CANVAS}
          hiddenColumns={hiddenColumns}
          columnActions={this.props.columnActions}
          columnNameMap={this.props.columnNameMap}
          columnTypeMap={this.props.columnTypeMap}
          columnOrder={this.props.columnOrder}
          pageSize={pageSize}
          onCommandClick={this.onCommandClick}
          selectedRowIndex={
            this.props.selectedRowIndex === undefined
              ? -1
              : this.props.selectedRowIndex
          }
          multiRowSelection={this.props.multiRowSelection}
          selectedRowIndexes={this.getSelectedRowIndexes(selectedRowIndexes)}
          serverSidePaginationEnabled={serverSidePaginationEnabled}
          onRowClick={this.handleRowClick}
          pageNo={pageNo}
          nextPageClick={this.handleNextPageClick}
          prevPageClick={this.handlePrevPageClick}
          updatePageNo={(pageNo: number) => {
            super.updateWidgetMetaProperty("pageNo", pageNo);
          }}
          updateHiddenColumns={(hiddenColumns?: string[]) => {
            super.updateWidgetProperty("hiddenColumns", hiddenColumns);
          }}
          updateColumnType={(columnTypeMap: {
            [key: string]: { type: string; format: string };
          }) => {
            super.updateWidgetProperty("columnTypeMap", columnTypeMap);
          }}
          updateColumnName={(columnNameMap: { [key: string]: string }) => {
            super.updateWidgetProperty("columnNameMap", columnNameMap);
          }}
          handleResizeColumn={(columnSizeMap: { [key: string]: number }) => {
            super.updateWidgetProperty("columnSizeMap", columnSizeMap);
          }}
          handleReorderColumn={(columnOrder: string[]) => {
            super.updateWidgetProperty("columnOrder", columnOrder);
          }}
          columnSizeMap={this.props.columnSizeMap}
          disableDrag={(disable: boolean) => {
            this.disableDrag(disable);
          }}
          searchTableData={this.handleSearchTable}
          filters={this.props.filters}
          applyFilter={(filters: ReactTableFilter[]) => {
            this.resetSelectedRowIndex();
            super.updateWidgetMetaProperty("filters", filters);
          }}
          compactMode={this.props.compactMode || CompactModeTypes.DEFAULT}
          updateCompactMode={(compactMode: CompactMode) => {
            if (this.props.renderMode === RenderModes.CANVAS) {
              super.updateWidgetProperty("compactMode", compactMode);
            } else {
              super.updateWidgetMetaProperty("compactMode", compactMode);
            }
          }}
          sortTableColumn={this.handleColumnSorting}
        />
      </Suspense>
    );
  }

  handleColumnSorting = (column: string, asc: boolean) => {
    this.resetSelectedRowIndex();
    if (column === "") {
      super.updateWidgetMetaProperty("sortedColumn", undefined);
    } else {
      super.updateWidgetMetaProperty("sortedColumn", {
        column: column,
        asc: asc,
      });
    }
  };

  handleSearchTable = (searchKey: any) => {
    const { onSearchTextChanged } = this.props;
    this.resetSelectedRowIndex();
    this.updateWidgetMetaProperty("pageNo", 1);
    super.updateWidgetMetaProperty("searchText", searchKey);
    if (onSearchTextChanged) {
      super.executeAction({
        dynamicString: onSearchTextChanged,
        event: {
          type: EventType.ON_SEARCH,
        },
      });
    }
  };

  updateHiddenColumns = (hiddenColumns?: string[]) => {
    super.updateWidgetProperty("hiddenColumns", hiddenColumns);
  };

  onCommandClick = (action: string, onComplete: () => void) => {
    super.executeAction({
      dynamicString: action,
      event: {
        type: EventType.ON_CLICK,
        callback: onComplete,
      },
    });
  };

  handleRowClick = (rowData: object, index: number) => {
    const { onRowSelected } = this.props;
    if (this.props.multiRowSelection) {
      const selectedRowIndexes = this.getSelectedRowIndexes(
        this.props.selectedRowIndexes,
      );
      if (selectedRowIndexes.includes(index)) {
        const rowIndex = selectedRowIndexes.indexOf(index);
        selectedRowIndexes.splice(rowIndex, 1);
      } else {
        selectedRowIndexes.push(index);
      }
      super.updateWidgetMetaProperty(
        "selectedRowIndexes",
        selectedRowIndexes.join(","),
      );
      super.updateWidgetMetaProperty(
        "selectedRows",
        this.props.filteredTableData.filter((item: object, i: number) => {
          return selectedRowIndexes.includes(i);
        }),
      );
    } else {
      super.updateWidgetMetaProperty("selectedRowIndex", index);
      super.updateWidgetMetaProperty(
        "selectedRow",
        this.props.filteredTableData[index],
      );
    }
    if (onRowSelected) {
      super.executeAction({
        dynamicString: onRowSelected,
        event: {
          type: EventType.ON_ROW_SELECTED,
        },
      });
    }
  };

  handleNextPageClick = () => {
    let pageNo = this.props.pageNo || 1;
    pageNo = pageNo + 1;
    super.updateWidgetMetaProperty("pageNo", pageNo);
    if (this.props.onPageChange) {
      this.resetSelectedRowIndex();
      super.executeAction({
        dynamicString: this.props.onPageChange,
        event: {
          type: EventType.ON_NEXT_PAGE,
        },
      });
    }
  };

  resetSelectedRowIndex = () => {
    super.updateWidgetMetaProperty("selectedRowIndex", -1);
    super.updateWidgetMetaProperty("selectedRowIndexes", "");
  };

  handlePrevPageClick = () => {
    let pageNo = this.props.pageNo || 1;
    pageNo = pageNo - 1;
    if (pageNo >= 1) {
      super.updateWidgetMetaProperty("pageNo", pageNo);
      if (this.props.onPageChange) {
        this.resetSelectedRowIndex();
        super.executeAction({
          dynamicString: this.props.onPageChange,
          event: {
            type: EventType.ON_PREV_PAGE,
          },
        });
      }
    }
  };

  getWidgetType(): WidgetType {
    return "TABLE_WIDGET";
  }
}

export type CompactMode = keyof typeof CompactModeTypes;
export type Condition = keyof typeof ConditionFunctions | "";
export type Operator = keyof typeof OperatorTypes;
export interface ReactTableFilter {
  column: string;
  operator: Operator;
  condition: Condition;
  value: any;
}
export interface TableColumnMetaProps {
  isHidden: boolean;
  format?: string;
  type: string;
}
export interface ReactTableColumnProps {
  Header: string;
  accessor: string;
  width: number;
  minWidth: number;
  draggable: boolean;
  isHidden?: boolean;
  isAscOrder?: boolean;
  metaProperties?: TableColumnMetaProps;
  Cell: (props: any) => JSX.Element;
}

export interface TableWidgetProps extends WidgetProps {
  nextPageKey?: string;
  prevPageKey?: string;
  label: string;
  searchText: string;
  defaultSearchText: string;
  tableData: object[];
  onPageChange?: string;
  pageSize: number;
  onRowSelected?: string;
  onSearchTextChanged: string;
  selectedRowIndex?: number;
  selectedRowIndexes: string;
  columnActions?: ColumnAction[];
  serverSidePaginationEnabled?: boolean;
  multiRowSelection?: boolean;
  hiddenColumns?: string[];
  columnOrder?: string[];
  columnNameMap?: { [key: string]: string };
  columnTypeMap?: { [key: string]: { type: string; format: string } };
  columnSizeMap?: { [key: string]: number };
  filters?: ReactTableFilter[];
  compactMode?: CompactMode;
  sortedColumn?: {
    column: string;
    asc: boolean;
  };
}

export default TableWidget;
export const ProfiledTableWidget = Sentry.withProfiler(TableWidget);
