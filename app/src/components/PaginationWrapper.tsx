import type { JSX } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export type PaginationWrapperPropTypes = {
  activePageNo: number,
  onPageSelect: (pageNo: number) => void,
  toFirst: VoidFunction,
  onPrevious: VoidFunction,
  onNext: VoidFunction,
  toLast: VoidFunction,
  totalPages: number,
}
export const PaginationWrapper = ({
  activePageNo,
  onPageSelect,
  toFirst,
  onPrevious,
  onNext,
  toLast,
  totalPages,
}: PaginationWrapperPropTypes): JSX.Element => {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationFirst onClick={toFirst} />
        </PaginationItem>
        <PaginationItem>
          <PaginationPrevious onClick={onPrevious} />
        </PaginationItem>
        
        <Pages
          activePageNo={activePageNo}
          onPageSelect={onPageSelect}
          totalPages={totalPages}
        />

        <PaginationItem>
          <PaginationNext onClick={onNext} />
        </PaginationItem>
        <PaginationItem>
          <PaginationLast onClick={toLast} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

const Pages = ({
  activePageNo,
  totalPages,
  onPageSelect
}: Pick<
  PaginationWrapperPropTypes,
  "activePageNo" | "totalPages" | "onPageSelect"
>): JSX.Element => {
  const renderedPages: Array<JSX.Element> = [];

  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
    renderedPages.push(
      <PaginationItem>
        <PaginationLink
          onClick={() => onPageSelect(pageNo)}
          isActive={pageNo === activePageNo}
        >{pageNo}</PaginationLink>
      </PaginationItem>
    )
  }

  return <>
    {renderedPages}
  </>
}
