"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { listDatasets } from "@/lib/dataset-service"
import type { Dataset } from "@/lib/dataset-types"

type AnalyticsScopeValue = {
  datasetId?: string
  setDatasetId: (datasetId: string | undefined) => void
  datasets: Dataset[]
  datasetsLoading: boolean
  datasetsError: string
  refreshDatasets: () => void
}

const AnalyticsScopeContext = createContext<AnalyticsScopeValue | null>(null)

export function AnalyticsScopeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [datasetId, setDatasetIdValue] = useState<string | undefined>()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)
  const [datasetsError, setDatasetsError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const selectedDatasetId = useRef<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    async function loadDatasets() {
      try {
        const firstPage = await listDatasets(1, 100)
        const allDatasets = [...firstPage.datasets]
        for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
          const response = await listDatasets(page, 100)
          allDatasets.push(...response.datasets)
        }
        if (active) {
          setDatasets(allDatasets)
          setDatasetsError("")
          setDatasetsLoading(false)
          if (
            selectedDatasetId.current &&
            !allDatasets.some((dataset) => dataset.id === selectedDatasetId.current)
          ) {
            selectedDatasetId.current = undefined
            setDatasetIdValue(undefined)
          }
        }
      } catch (error) {
        if (active) {
          setDatasetsError(
            error instanceof Error ? error.message : "Could not load datasets.",
          )
          setDatasetsLoading(false)
        }
      }
    }
    void loadDatasets()
    return () => {
      active = false
    }
  }, [reloadKey])

  const setDatasetId = useCallback((value: string | undefined) => {
    selectedDatasetId.current = value || undefined
    setDatasetIdValue(value || undefined)
  }, [])
  const refreshDatasets = useCallback(() => {
    setDatasetsLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const value = useMemo(
    () => ({
      datasetId,
      setDatasetId,
      datasets,
      datasetsLoading,
      datasetsError,
      refreshDatasets,
    }),
    [datasetId, setDatasetId, datasets, datasetsLoading, datasetsError, refreshDatasets],
  )

  return (
    <AnalyticsScopeContext.Provider value={value}>
      {children}
    </AnalyticsScopeContext.Provider>
  )
}

export function useAnalyticsScope() {
  const context = useContext(AnalyticsScopeContext)
  if (!context) {
    throw new Error("useAnalyticsScope must be used within an AnalyticsScopeProvider.")
  }
  return context
}
